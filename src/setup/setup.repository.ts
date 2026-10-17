import { Injectable } from '@nestjs/common';
import { SETUP_STATUS } from '../constants/setup.constants.js';
import type { DatabaseClient } from '../database/database-client.js';
import {
  RegisterEntryEntity,
  RegisterRevisionEntity,
  RegisterPackSourceEntity,
  SetupDraftEntity,
} from '../database/entities/index.js';
import type { TenantScope, RegisterData } from '@sahmati/contracts';
@Injectable()
export class SetupRepository {
  lock(client: DatabaseClient, scope: TenantScope) {
    return client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      scope.tenantId + ':' + scope.branchId,
    ]);
  }
  row(client: DatabaseClient, scope: TenantScope, lock = false) {
    return client.manager.getRepository(SetupDraftEntity).findOne({
      where: { tenantId: scope.tenantId, branchId: scope.branchId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }
  insert(
    client: DatabaseClient,
    scope: TenantScope,
    input: {
      organisationName: string;
      packId: string;
      packVersion: number;
      step: 1 | 2 | 3;
      draft: RegisterData | null;
    },
  ) {
    return client.manager.getRepository(SetupDraftEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      version: 1,
      status: SETUP_STATUS.draft,
      ...input,
    });
  }
  update(
    client: DatabaseClient,
    scope: TenantScope,
    input: {
      organisationName: string;
      step: 1 | 2 | 3;
      draft: RegisterData | null;
      version: number;
    },
  ) {
    return client.manager
      .getRepository(SetupDraftEntity)
      .update(
        { tenantId: scope.tenantId, branchId: scope.branchId },
        { ...input, updatedAt: new Date() },
      );
  }
  async createRegister(
    client: DatabaseClient,
    scope: TenantScope,
    id: string,
    prior: SetupDraftEntity,
  ) {
    await client.manager.getRepository(RegisterEntryEntity).insert({
      tenantId: scope.tenantId,
      id,
      branchId: scope.branchId,
      data: prior.draft!,
      status: SETUP_STATUS.draft,
      version: 1,
    });
    await client.manager.getRepository(RegisterRevisionEntity).insert({
      tenantId: scope.tenantId,
      entryId: id,
      version: 1,
      data: prior.draft!,
      actorId: scope.userId,
    });
    await client.manager.getRepository(RegisterPackSourceEntity).insert({
      tenantId: scope.tenantId,
      entryId: id,
      packId: prior.packId,
      packVersion: prior.packVersion,
    });
  }
  complete(client: DatabaseClient, scope: TenantScope, id: string, key: string, version: number) {
    return client.manager.getRepository(SetupDraftEntity).update(
      { tenantId: scope.tenantId, branchId: scope.branchId },
      {
        status: SETUP_STATUS.completed,
        version,
        registerEntryId: id,
        completionKey: key,
        updatedAt: new Date(),
      },
    );
  }
}
