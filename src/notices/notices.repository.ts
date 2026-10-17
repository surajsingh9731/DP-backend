import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { TenantScope, NoticeSnapshotView, NoticeDecision } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { RegisterEntryEntity, RegisterPackSourceEntity } from '../database/entities/index.js';
import {
  NoticeSnapshotEntity,
  NoticeReviewEntity,
  NoticeDecisionEntity,
  NoticeCommandEntity,
} from './entities/index.js';
import { NOTICE_LIMITS } from '../constants/notices.constants.js';
@Injectable()
export class NoticesRepository {
  lockCommand(client: DatabaseClient, scope: TenantScope, key: string) {
    return client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${scope.tenantId}:${scope.branchId}:notice:${key}`,
    ]);
  }
  command(client: DatabaseClient, scope: TenantScope, key: string) {
    return client.manager
      .getRepository(NoticeCommandEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, idempotencyKey: key });
  }
  saveCommand(
    client: DatabaseClient,
    scope: TenantScope,
    key: string,
    hash: string,
    response: NoticeSnapshotView,
  ) {
    return client.manager.getRepository(NoticeCommandEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      idempotencyKey: key,
      payloadHash: hash,
      response,
      noticeId: response.id,
    });
  }
  entry(client: DatabaseClient, scope: TenantScope, id: string) {
    return client.manager.getRepository(RegisterEntryEntity).findOne({
      where: { tenantId: scope.tenantId, branchId: scope.branchId, id },
      lock: { mode: 'pessimistic_write' },
    });
  }
  source(client: DatabaseClient, scope: TenantScope, id: string) {
    return client.manager
      .getRepository(RegisterPackSourceEntity)
      .findOneBy({ tenantId: scope.tenantId, entryId: id });
  }
  snapshot(client: DatabaseClient, scope: TenantScope, id: string) {
    return client.manager
      .getRepository(NoticeSnapshotEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, id });
  }
  snapshots(client: DatabaseClient, scope: TenantScope) {
    return client.manager.getRepository(NoticeSnapshotEntity).find({
      where: { tenantId: scope.tenantId, branchId: scope.branchId },
      order: { submittedAt: 'DESC', id: 'ASC' },
      take: NOTICE_LIMITS.list,
    });
  }
  review(client: DatabaseClient, scope: TenantScope, id: string, lock = false) {
    return client.manager.getRepository(NoticeReviewEntity).findOne({
      where: { tenantId: scope.tenantId, noticeId: id },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }
  reviews(client: DatabaseClient, scope: TenantScope, ids: string[]) {
    return client.manager
      .getRepository(NoticeReviewEntity)
      .findBy({ tenantId: scope.tenantId, noticeId: In(ids) });
  }
  decisions(client: DatabaseClient, scope: TenantScope, ids: string[]) {
    return client.manager
      .getRepository(NoticeDecisionEntity)
      .find({ where: { tenantId: scope.tenantId, noticeId: In(ids) }, order: { version: 'ASC' } });
  }
  insertSnapshot(client: DatabaseClient, row: NoticeSnapshotEntity) {
    return client.manager.getRepository(NoticeSnapshotEntity).insert(row);
  }
  insertReview(client: DatabaseClient, row: NoticeReviewEntity) {
    return client.manager.getRepository(NoticeReviewEntity).insert(row);
  }
  updateReview(
    client: DatabaseClient,
    scope: TenantScope,
    id: string,
    version: number,
    status: NoticeReviewEntity['status'],
  ) {
    return client.manager
      .getRepository(NoticeReviewEntity)
      .update({ tenantId: scope.tenantId, noticeId: id }, { version, status });
  }
  insertDecision(
    client: DatabaseClient,
    scope: TenantScope,
    id: string,
    decisionId: string,
    version: number,
    decision: NoticeDecision,
    comment: string | null,
  ) {
    return client.manager.getRepository(NoticeDecisionEntity).insert({
      tenantId: scope.tenantId,
      id: decisionId,
      noticeId: id,
      version,
      decision,
      comment,
      decidedBy: scope.userId,
    });
  }
}
