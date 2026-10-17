import { Injectable } from '@nestjs/common';
import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import {
  TaskEntity,
  UserEntity,
  MembershipEntity,
  OrganisationEntity,
} from '../database/entities/foundation.entities.js';
import { WORKSPACE_SUMMARY_LIMIT } from '../constants/workspace.constants.js';
import type { TaskRow } from './workspace.types.js';

@Injectable()
export class WorkspaceRepository {
  organisation(client: DatabaseClient, tenantId: string) {
    return client.manager
      .getRepository(OrganisationEntity)
      .findOne({ where: { id: tenantId }, select: { name: true } });
  }

  private taskQuery(client: DatabaseClient) {
    return client.manager
      .getRepository(TaskEntity)
      .createQueryBuilder('t')
      .select([
        't.id AS id',
        't.template AS template',
        't.status AS status',
        't.assignee_id AS assignee_id',
        't.version AS version',
        't.created_at AS created_at',
        'u.display_name AS assignee',
      ])
      .innerJoin(UserEntity, 'u', 'u.id = t.assigneeId');
  }

  tasks(client: DatabaseClient, scope: TenantScope) {
    return this.taskQuery(client)
      .where('t.branch_id = :branchId', { branchId: scope.branchId })
      .andWhere("(:role::text <> 'staff' OR t.assignee_id = :userId)", {
        role: scope.role,
        userId: scope.userId,
      })
      .orderBy('t.created_at', 'DESC')
      .addOrderBy('t.id')
      .limit(WORKSPACE_SUMMARY_LIMIT)
      .getRawMany<TaskRow>();
  }

  async evidenceInView(client: DatabaseClient, scope: TenantScope) {
    const result = await client.query<{
      id: string;
      task_id: string;
      action: string;
      occurred_at: Date;
      event_hash: string;
      sequence: string;
    }>(
      "SELECT e.id,e.task_id,e.action,e.occurred_at,e.event_hash,e.sequence FROM workspace.evidence e JOIN workspace.tasks t ON t.tenant_id=e.tenant_id AND t.id=e.task_id WHERE t.branch_id=$1 AND ($2::text<>'staff' OR t.assignee_id=$3) ORDER BY e.sequence DESC LIMIT $4",
      [scope.branchId, scope.role, scope.userId, WORKSPACE_SUMMARY_LIMIT],
    );
    return result.rows;
  }

  async deliveries(client: DatabaseClient, scope: TenantScope) {
    const result = await client.query<{ pending: number; sent: number; failed: number }>(
      "SELECT count(*) FILTER(WHERE o.status IN ('pending','processing'))::int AS pending,count(*) FILTER(WHERE o.status='sent')::int AS sent,count(*) FILTER(WHERE o.status='failed')::int AS failed FROM workspace.outbox o JOIN workspace.tasks t ON t.tenant_id=o.tenant_id AND t.id=o.task_id WHERE t.branch_id=$1 AND ($2::text<>'staff' OR t.assignee_id=$3)",
      [scope.branchId, scope.role, scope.userId],
    );
    return result.rows[0] ?? { pending: 0, sent: 0, failed: 0 };
  }

  async lockTenant(client: DatabaseClient, tenantId: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tenantId]);
  }

  priorTask(client: DatabaseClient, idempotencyKey: string) {
    return this.taskQuery(client)
      .where('t.idempotency_key = :idempotencyKey', { idempotencyKey })
      .getRawOne<TaskRow>();
  }

  assignee(client: DatabaseClient, scope: TenantScope) {
    return client.manager
      .getRepository(MembershipEntity)
      .createQueryBuilder('m')
      .select(['m.user_id AS user_id', 'u.email AS email', 'u.display_name AS display_name'])
      .innerJoin(UserEntity, 'u', 'u.id = m.userId')
      .where('m.tenant_id = :tenantId AND m.branch_id = :branchId', {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
      })
      .andWhere('m.active = true AND u.active = true')
      .andWhere('m.role IN (:...roles)', { roles: ['staff', 'owner'] })
      .orderBy("(m.role='staff')", 'DESC')
      .addOrderBy('m.user_id')
      .limit(1)
      .getRawOne<{ user_id: string; email: string; display_name: string }>();
  }

  async insertTask(
    client: DatabaseClient,
    scope: TenantScope,
    id: string,
    assigneeId: string,
    template: string,
    idempotencyKey: string,
  ): Promise<TaskRow> {
    const result = await client.manager
      .getRepository(TaskEntity)
      .createQueryBuilder()
      .insert()
      .values({
        tenantId: scope.tenantId,
        id,
        branchId: scope.branchId,
        assigneeId,
        template: template as TaskRow['template'],
        idempotencyKey,
      })
      .returning('*')
      .execute();
    return (result.raw as TaskRow[])[0]!;
  }

  async lockTask(client: DatabaseClient, id: string, branchId: string) {
    const result = await client.query<TaskRow>(
      'SELECT t.*,u.display_name AS assignee FROM workspace.tasks t JOIN identity.users u ON u.id=t.assignee_id WHERE t.id=$1 AND t.branch_id=$2 FOR UPDATE OF t',
      [id, branchId],
    );
    return result.rows[0];
  }

  async closeTask(client: DatabaseClient, id: string): Promise<void> {
    await client.manager
      .getRepository(TaskEntity)
      .createQueryBuilder()
      .update()
      .set({ status: 'closed', version: () => 'version + 1' })
      .where('id = :id', { id })
      .execute();
  }

  async latestEvidence(client: DatabaseClient) {
    const result = await client.query<{ sequence: string; event_hash: string }>(
      'SELECT sequence,event_hash FROM workspace.evidence ORDER BY sequence DESC LIMIT 1',
    );
    return result.rows[0];
  }

  async appendEvidence(client: DatabaseClient, values: unknown[]): Promise<void> {
    await client.query(
      'INSERT INTO workspace.evidence(tenant_id,id,sequence,task_id,actor_id,action,previous_hash,event_hash,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      values,
    );
  }

  async enqueueMessage(client: DatabaseClient, values: unknown[]): Promise<void> {
    await client.query(
      'INSERT INTO workspace.outbox(tenant_id,id,task_id,recipient,subject,body,language) VALUES($1,$2,$3,$4,$5,$6,$7)',
      values,
    );
  }
}
