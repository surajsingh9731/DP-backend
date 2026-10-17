import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConsentOffer, ConsentReceipt, TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { CONSENT_LIMITS } from '../constants/consent.constants.js';
import {
  ConsentOfferEntity,
  ConsentParticipantEntity,
  ConsentReceiptEntity,
  ConsentCommandEntity,
} from './entities/index.js';
import { consentHash } from './consent.policy.js';
@Injectable()
export class ConsentRepository {
  lockCatalog(client: DatabaseClient, scope: TenantScope, noticeId: string) {
    return client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${scope.tenantId}:${scope.branchId}:consent:${noticeId}`,
    ]);
  }
  async offer(client: DatabaseClient, scope: TenantScope, id: string) {
    const row = await client.manager
      .getRepository(ConsentOfferEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, id });
    if (!row) throw new NotFoundException('Sample offer unavailable.');
    return row;
  }
  offers(client: DatabaseClient, scope: TenantScope) {
    return client.manager.getRepository(ConsentOfferEntity).find({
      where: { tenantId: scope.tenantId, branchId: scope.branchId },
      order: { version: 'DESC', id: 'ASC' },
      take: CONSENT_LIMITS.list,
    });
  }
  latest(client: DatabaseClient, scope: TenantScope, noticeId: string) {
    return client.manager.getRepository(ConsentOfferEntity).findOne({
      where: { tenantId: scope.tenantId, branchId: scope.branchId, noticeId },
      order: { version: 'DESC' },
    });
  }
  insertOffer(client: DatabaseClient, scope: TenantScope, data: ConsentOffer) {
    return client.manager.getRepository(ConsentOfferEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      id: data.id,
      noticeId: data.notice.id,
      version: data.version,
      data,
    });
  }
  async participant(client: DatabaseClient, scope: TenantScope, id: string, lock = false) {
    const row = await client.manager.getRepository(ConsentParticipantEntity).findOne({
      where: { tenantId: scope.tenantId, branchId: scope.branchId, id },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!row) throw new NotFoundException('Synthetic session unavailable.');
    return row;
  }
  insertParticipant(client: DatabaseClient, row: ConsentParticipantEntity) {
    return client.manager.getRepository(ConsentParticipantEntity).insert(row);
  }
  updateParticipant(client: DatabaseClient, row: ConsentParticipantEntity) {
    return client.manager
      .getRepository(ConsentParticipantEntity)
      .update(
        { tenantId: row.tenantId, id: row.id },
        { version: row.version, revoked: row.revoked },
      );
  }
  receipts(client: DatabaseClient, scope: TenantScope, sessionId?: string) {
    return client.manager.getRepository(ConsentReceiptEntity).find({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        ...(sessionId ? { sessionId } : {}),
      },
      order: sessionId ? { version: 'DESC', id: 'ASC' } : { occurredAt: 'DESC', id: 'ASC' },
      take: CONSENT_LIMITS.list,
    });
  }
  insertReceipt(client: DatabaseClient, scope: TenantScope, data: ConsentReceipt) {
    return client.manager.getRepository(ConsentReceiptEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      id: data.id,
      sessionId: data.sessionId,
      version: data.version,
      occurredAt: new Date(data.occurredAt),
      data,
    });
  }
  async command(client: DatabaseClient, scope: TenantScope, key: string, payload: unknown) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${scope.tenantId}:${scope.branchId}:${scope.userId}:consent-command:${key}`,
    ]);
    const hash = consentHash(payload);
    const prior = await client.manager.getRepository(ConsentCommandEntity).findOneBy({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      actorId: scope.userId,
      idempotencyKey: key,
    });
    if (prior && prior.payloadHash !== hash)
      throw new ConflictException('Idempotency key has a different payload.');
    return { hash, response: prior?.response };
  }
  saveCommand(
    client: DatabaseClient,
    scope: TenantScope,
    key: string,
    payloadHash: string,
    response: ConsentOffer | ConsentReceipt,
  ) {
    return client.manager.getRepository(ConsentCommandEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      actorId: scope.userId,
      idempotencyKey: key,
      payloadHash,
      response,
    });
  }
}
