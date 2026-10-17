import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { DatabaseClient } from '../database/database-client.js';
import {
  RegisterEntryEntity,
  RegisterRevisionEntity,
  RegisterPackSourceEntity,
} from '../database/entities/index.js';
import type { RegisterData, RegisterView, TenantScope } from '@sahmati/contracts';
import { REGISTER_LIMITS } from '../constants/register.constants.js';
@Injectable()
export class RegisterRepository {
  entry(c: DatabaseClient, s: TenantScope, id: string, lock = false) {
    return c.manager.getRepository(RegisterEntryEntity).findOne({
      where: { tenantId: s.tenantId, branchId: s.branchId, id },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }
  list(c: DatabaseClient, s: TenantScope) {
    return c.manager.getRepository(RegisterEntryEntity).find({
      where: { tenantId: s.tenantId, branchId: s.branchId },
      order: { updatedAt: 'DESC', id: 'ASC' },
      take: REGISTER_LIMITS.list,
    });
  }
  async sources(c: DatabaseClient, s: TenantScope, ids: string[]) {
    if (!ids.length) return new Map<string, NonNullable<RegisterView['sourcePack']>>();
    const rows = await c.manager
      .getRepository(RegisterPackSourceEntity)
      .findBy({ tenantId: s.tenantId, entryId: In(ids) });
    return new Map(
      rows.map((p) => [
        p.entryId,
        { id: p.packId, version: p.packVersion, reviewStatus: 'unreviewed' as const },
      ]),
    );
  }
  async source(c: DatabaseClient, s: TenantScope, id: string): Promise<RegisterView['sourcePack']> {
    const p = await c.manager
      .getRepository(RegisterPackSourceEntity)
      .findOneBy({ tenantId: s.tenantId, entryId: id });
    return p ? { id: p.packId, version: p.packVersion, reviewStatus: 'unreviewed' } : undefined;
  }
  insert(c: DatabaseClient, s: TenantScope, id: string, data: RegisterData) {
    return c.manager.getRepository(RegisterEntryEntity).insert({
      tenantId: s.tenantId,
      id,
      branchId: s.branchId,
      data,
      status: 'draft',
      version: 1,
    });
  }
  update(c: DatabaseClient, s: TenantScope, id: string, data: RegisterData, version: number) {
    return c.manager
      .getRepository(RegisterEntryEntity)
      .update(
        { tenantId: s.tenantId, branchId: s.branchId, id },
        { data, version, updatedAt: new Date() },
      );
  }
  revision(c: DatabaseClient, s: TenantScope, id: string, data: RegisterData, version: number) {
    return c.manager
      .getRepository(RegisterRevisionEntity)
      .insert({ tenantId: s.tenantId, entryId: id, version, data, actorId: s.userId });
  }
  history(c: DatabaseClient, s: TenantScope, id: string) {
    return c.manager
      .getRepository(RegisterRevisionEntity)
      .find({ where: { tenantId: s.tenantId, entryId: id }, order: { version: 'DESC' } });
  }
}
