import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RightsRequest, RightsEvent, TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { RightsRequestEntity, RightsEventEntity, RightsCommandEntity } from './entities/index.js';
import { RIGHTS_LIMITS } from '../constants/rights.constants.js';
import { followupDigest } from '../followups/followup-locations.js';
@Injectable()
export class RightsRepository {
  list(client: DatabaseClient, scope: TenantScope, sessionId?: string) {
    return client.manager.getRepository(RightsRequestEntity).find({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        ...(sessionId ? { sessionId } : scope.role === 'staff' ? { assigneeId: scope.userId } : {}),
      },
      order: { updatedAt: 'DESC', id: 'ASC' },
      take: RIGHTS_LIMITS.list,
    });
  }
  async request(
    client: DatabaseClient,
    scope: TenantScope,
    id: string,
    lock = false,
    sessionId?: string,
  ) {
    const row = await client.manager.getRepository(RightsRequestEntity).findOne({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        id,
        ...(sessionId ? { sessionId } : scope.role === 'staff' ? { assigneeId: scope.userId } : {}),
      },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!row) throw new NotFoundException('Rights request unavailable.');
    return row;
  }
  insert(client: DatabaseClient, scope: TenantScope, data: RightsRequest) {
    return client.manager.getRepository(RightsRequestEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      id: data.id,
      sessionId: data.sessionId,
      assigneeId: data.assignee?.id ?? null,
      version: data.version,
      updatedAt: new Date(data.updatedAt),
      data,
    });
  }
  update(client: DatabaseClient, scope: TenantScope, data: RightsRequest) {
    return client.manager.getRepository(RightsRequestEntity).update(
      { tenantId: scope.tenantId, id: data.id },
      {
        assigneeId: data.assignee?.id ?? null,
        version: data.version,
        updatedAt: new Date(data.updatedAt),
        data,
      },
    );
  }
  history(client: DatabaseClient, scope: TenantScope, id: string) {
    return client.manager.getRepository(RightsEventEntity).find({
      where: { tenantId: scope.tenantId, requestId: id },
      order: { version: 'DESC' },
      take: RIGHTS_LIMITS.history,
    });
  }
  append(client: DatabaseClient, scope: TenantScope, event: RightsEvent) {
    return client.manager.getRepository(RightsEventEntity).insert({
      tenantId: scope.tenantId,
      requestId: event.request.id,
      version: event.version,
      data: event,
    });
  }
  async command(client: DatabaseClient, scope: TenantScope, key: string, payload: unknown) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${scope.tenantId}:${scope.branchId}:${scope.userId}:rights-command:${key}`,
    ]);
    const hash = followupDigest(payload);
    const row = await client.manager.getRepository(RightsCommandEntity).findOneBy({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      actorId: scope.userId,
      idempotencyKey: key,
    });
    if (row && row.payloadHash !== hash)
      throw new ConflictException('Idempotency key has a different payload.');
    return { hash, response: row?.response };
  }
  saveCommand(
    client: DatabaseClient,
    scope: TenantScope,
    key: string,
    payloadHash: string,
    response: RightsRequest | { requestId: string },
  ) {
    return client.manager.getRepository(RightsCommandEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      actorId: scope.userId,
      idempotencyKey: key,
      payloadHash,
      response,
    });
  }
}
