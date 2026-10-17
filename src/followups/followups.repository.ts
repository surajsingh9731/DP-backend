import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  FollowupTask,
  FollowupEvent,
  FollowupAssignee,
  TenantScope,
} from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import { MembershipEntity, UserEntity } from '../database/entities/foundation.entities.js';
import {
  FollowupTaskEntity,
  FollowupEventEntity,
  FollowupCommandEntity,
} from './entities/index.js';
import { FOLLOWUP_LIMITS } from '../constants/followups.constants.js';
import { followupDigest } from './followup-locations.js';
@Injectable()
export class FollowupsRepository {
  lockReceipt(client: DatabaseClient, scope: TenantScope, id: string) {
    return client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${scope.tenantId}:${scope.branchId}:followup:${id}`,
    ]);
  }
  list(client: DatabaseClient, scope: TenantScope, receiptId?: string) {
    return client.manager.getRepository(FollowupTaskEntity).find({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        ...(receiptId ? { receiptId } : {}),
        ...(scope.role === 'staff' ? { assigneeId: scope.userId } : {}),
      },
      order: { updatedAt: 'DESC', id: 'ASC' },
      take: FOLLOWUP_LIMITS.list,
    });
  }
  locationTask(client: DatabaseClient, scope: TenantScope, receiptId: string, locationKey: string) {
    return client.manager
      .getRepository(FollowupTaskEntity)
      .findOneBy({ tenantId: scope.tenantId, branchId: scope.branchId, receiptId, locationKey });
  }
  async task(client: DatabaseClient, scope: TenantScope, id: string, lock = false) {
    const row = await client.manager.getRepository(FollowupTaskEntity).findOne({
      where: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        id,
        ...(scope.role === 'staff' ? { assigneeId: scope.userId } : {}),
      },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!row) throw new NotFoundException('Follow-up task unavailable.');
    return row;
  }
  insert(client: DatabaseClient, scope: TenantScope, task: FollowupTask) {
    return client.manager.getRepository(FollowupTaskEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      id: task.id,
      receiptId: task.receiptId,
      locationKey: task.location.key,
      assigneeId: task.assignee?.id ?? null,
      version: task.version,
      updatedAt: new Date(task.updatedAt),
      data: task,
    });
  }
  update(client: DatabaseClient, scope: TenantScope, task: FollowupTask) {
    return client.manager.getRepository(FollowupTaskEntity).update(
      { tenantId: scope.tenantId, id: task.id },
      {
        locationKey: task.location.key,
        assigneeId: task.assignee?.id ?? null,
        version: task.version,
        updatedAt: new Date(task.updatedAt),
        data: task,
      },
    );
  }
  history(client: DatabaseClient, scope: TenantScope, id: string) {
    return client.manager.getRepository(FollowupEventEntity).find({
      where: { tenantId: scope.tenantId, taskId: id },
      order: { version: 'DESC' },
      take: FOLLOWUP_LIMITS.history,
    });
  }
  append(client: DatabaseClient, scope: TenantScope, event: FollowupEvent) {
    return client.manager.getRepository(FollowupEventEntity).insert({
      tenantId: scope.tenantId,
      taskId: event.task.id,
      version: event.version,
      data: event,
    });
  }
  async assignees(client: DatabaseClient, scope: TenantScope): Promise<FollowupAssignee[]> {
    const rows = await client.manager
      .getRepository(MembershipEntity)
      .createQueryBuilder('m')
      .innerJoin(UserEntity, 'u', 'u.id=m.userId')
      .select(['m.userId AS id', 'm.role AS role', 'u.displayName AS "displayName"'])
      .where('m.tenantId=:tenant AND m.branchId=:branch AND m.active=true AND u.active=true', {
        tenant: scope.tenantId,
        branch: scope.branchId,
      })
      .andWhere("m.role IN ('owner','staff')")
      .orderBy('u.displayName')
      .limit(FOLLOWUP_LIMITS.list)
      .getRawMany<FollowupAssignee>();
    return rows;
  }
  async assignee(
    client: DatabaseClient,
    scope: TenantScope,
    id: string,
  ): Promise<FollowupAssignee> {
    const member = (
      await client.query<{ role: 'owner' | 'staff' | 'viewer'; branch_id: string }>(
        'SELECT role,branch_id FROM identity.active_membership_for_action($1,$2)',
        [scope.tenantId, id],
      )
    ).rows[0];
    const user = member
      ? await client.manager.getRepository(UserEntity).findOneBy({ id, active: true })
      : null;
    if (!member || member.branch_id !== scope.branchId || member.role === 'viewer' || !user)
      throw new ConflictException('Assignee must be an active owner/staff member of this branch.');
    return { id, role: member.role, displayName: user.displayName };
  }
  async command(client: DatabaseClient, scope: TenantScope, key: string, payload: unknown) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${scope.tenantId}:${scope.branchId}:${scope.userId}:followup-command:${key}`,
    ]);
    const hash = followupDigest(payload);
    const prior = await client.manager.getRepository(FollowupCommandEntity).findOneBy({
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
    response: FollowupTask | FollowupTask[],
  ) {
    return client.manager.getRepository(FollowupCommandEntity).insert({
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      actorId: scope.userId,
      idempotencyKey: key,
      payloadHash,
      response,
    });
  }
}
