import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MoreThan } from 'typeorm';
import type {
  TenantScope,
  RetentionPolicy,
  RetentionHold,
  RetentionSnapshot,
  RetentionEvent,
} from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { RegisterEntryEntity } from '../database/entities/register-entries.entity.js';
import {
  RetentionPolicyEntity,
  RetentionHoldEntity,
  RetentionPolicyEventEntity,
  RetentionHoldEventEntity,
  RetentionPreviewEntity,
  RetentionCommandEntity,
} from './entities/index.js';
import { followupDigest } from '../followups/followup-locations.js';
import { RETENTION_LIMITS } from '../constants/retention.constants.js';
export type RetentionRecordKind = 'policy' | 'hold';
@Injectable()
export class RetentionRepository {
  private records(client: DatabaseClient, kind: RetentionRecordKind) {
    return client.manager.getRepository(
      kind === 'policy' ? RetentionPolicyEntity : RetentionHoldEntity,
    );
  }
  private events(client: DatabaseClient, kind: RetentionRecordKind) {
    return client.manager.getRepository(
      kind === 'policy' ? RetentionPolicyEventEntity : RetentionHoldEventEntity,
    );
  }
  async entry(client: DatabaseClient, scope: TenantScope, id: string) {
    const row = await client.manager
      .getRepository(RegisterEntryEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, id });
    if (!row) throw new NotFoundException('Synthetic activity unavailable.');
    return row;
  }
  async record(
    client: DatabaseClient,
    scope: TenantScope,
    kind: RetentionRecordKind,
    id: string,
    lock = false,
  ) {
    const row = await this.records(client, kind).findOne({
      where: { tenantId: scope.tenantId, branchId: scope.branchId, id },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!row) throw new NotFoundException('Retention record unavailable.');
    return row;
  }
  list(
    client: DatabaseClient,
    scope: TenantScope,
    kind: RetentionRecordKind,
    entryId: string,
    limit: number,
    after?: string,
  ) {
    return this.records(client, kind).find({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        entryId,
        ...(after ? { id: MoreThan(after) } : {}),
      },
      order: { id: 'ASC' },
      take: limit + 1,
    });
  }
  insert(
    client: DatabaseClient,
    scope: TenantScope,
    kind: RetentionRecordKind,
    data: RetentionPolicy | RetentionHold,
  ) {
    return this.records(client, kind).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      id: data.id,
      entryId: data.entryId,
      version: data.version,
      data,
    });
  }
  update(
    client: DatabaseClient,
    scope: TenantScope,
    kind: RetentionRecordKind,
    data: RetentionPolicy | RetentionHold,
  ) {
    return this.records(client, kind).update(
      { tenantId: scope.tenantId, branchId: scope.branchId, id: data.id },
      { version: data.version, data },
    );
  }
  history(client: DatabaseClient, scope: TenantScope, kind: RetentionRecordKind, id: string) {
    return this.events(client, kind).find({
      where: { tenantId: scope.tenantId, recordId: id },
      order: { version: 'DESC' },
      take: RETENTION_LIMITS.history,
    });
  }
  append(
    client: DatabaseClient,
    scope: TenantScope,
    kind: RetentionRecordKind,
    data: RetentionEvent<RetentionPolicy | RetentionHold>,
  ) {
    return this.events(client, kind).insert({
      tenantId: scope.tenantId,
      recordId: data.record.id,
      version: data.version,
      data,
    });
  }
  async command(client: DatabaseClient, scope: TenantScope, key: string, payload: unknown) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${scope.tenantId}:${scope.branchId}:${scope.userId}:retention:${key}`,
    ]);
    const hash = followupDigest(payload),
      row = await client.manager.getRepository(RetentionCommandEntity).findOneBy({
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        actorId: scope.userId,
        idempotencyKey: key,
      });
    if (row && row.payloadHash !== hash)
      throw new ConflictException('Idempotency payload changed.');
    return { hash, response: row?.response };
  }
  saveCommand(
    client: DatabaseClient,
    scope: TenantScope,
    key: string,
    payloadHash: string,
    response: RetentionCommandEntity['response'],
  ) {
    return client.manager.getRepository(RetentionCommandEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      actorId: scope.userId,
      idempotencyKey: key,
      payloadHash,
      response,
    });
  }
  previewInsert(client: DatabaseClient, scope: TenantScope, data: RetentionSnapshot) {
    return client.manager.getRepository(RetentionPreviewEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      id: data.id,
      entryId: data.entryId,
      data,
    });
  }
  previews(
    client: DatabaseClient,
    scope: TenantScope,
    entryId: string,
    limit: number,
    after?: string,
  ) {
    return client.manager.getRepository(RetentionPreviewEntity).find({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        entryId,
        ...(after ? { id: MoreThan(after) } : {}),
      },
      order: { id: 'ASC' },
      take: limit + 1,
    });
  }
  async preview(client: DatabaseClient, scope: TenantScope, id: string) {
    const row = await client.manager
      .getRepository(RetentionPreviewEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, id });
    if (!row) throw new NotFoundException('Dry-run snapshot unavailable.');
    return row.data;
  }
}
