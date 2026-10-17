import { Injectable } from '@nestjs/common';
import type { TenantScope, PreparationRecordView } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import {
  PreparationRecordEntity,
  PreparationRevisionEntity,
  PreparationCommandEntity,
} from './entities/index.js';
import { PREPARATION_LIMITS } from '../constants/preparation.constants.js';
@Injectable()
export class PreparationRepository {
  lockCommand(client: DatabaseClient, scope: TenantScope, key: string) {
    return client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${scope.tenantId}:${scope.branchId}:preparation:${key}`,
    ]);
  }
  command(client: DatabaseClient, scope: TenantScope, key: string) {
    return client.manager
      .getRepository(PreparationCommandEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, idempotencyKey: key });
  }
  saveCommand(
    client: DatabaseClient,
    scope: TenantScope,
    key: string,
    hash: string,
    response: PreparationRecordView,
  ) {
    return client.manager.getRepository(PreparationCommandEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      idempotencyKey: key,
      recordId: response.id,
      payloadHash: hash,
      response,
    });
  }
  list(client: DatabaseClient, scope: TenantScope) {
    return client.manager.getRepository(PreparationRecordEntity).find({
      where: { tenantId: scope.tenantId, branchId: scope.branchId },
      order: { updatedAt: 'DESC', id: 'ASC' },
      take: PREPARATION_LIMITS.list,
    });
  }
  record(client: DatabaseClient, scope: TenantScope, id: string, lock = false) {
    return client.manager.getRepository(PreparationRecordEntity).findOne({
      where: { tenantId: scope.tenantId, branchId: scope.branchId, id },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }
  insert(client: DatabaseClient, row: PreparationRecordEntity) {
    return client.manager.getRepository(PreparationRecordEntity).insert(row);
  }
  update(client: DatabaseClient, row: PreparationRecordEntity) {
    const { tenantId, id, ...changes } = row;
    return client.manager.getRepository(PreparationRecordEntity).update({ tenantId, id }, changes);
  }
  revision(client: DatabaseClient, row: Omit<PreparationRevisionEntity, 'createdAt'>) {
    return client.manager.getRepository(PreparationRevisionEntity).insert(row);
  }
  history(client: DatabaseClient, scope: TenantScope, id: string) {
    return client.manager.getRepository(PreparationRevisionEntity).find({
      where: { tenantId: scope.tenantId, recordId: id },
      order: { version: 'DESC' },
      take: PREPARATION_LIMITS.history,
    });
  }
}
