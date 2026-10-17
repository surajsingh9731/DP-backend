import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TaskView, TenantScope, WorkspaceView } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import type { DatabaseClient } from '../database/database-client.js';
import { mayClose } from '../auth/permissions.js';
import { taskMessage } from '../messages/message-renderer.js';
import { WORKSPACE_ROLES } from '../constants/security.constants.js';
import {
  EVIDENCE_ACTIONS,
  EVIDENCE_GENESIS,
  TASK_STATUS,
} from '../constants/workspace.constants.js';
import { CreateTaskDto } from './create-task.dto.js';
import { eventDigest } from './event-digest.js';
import { taskView } from './task.mapper.js';
import { WorkspaceRepository } from './workspace.repository.js';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly db: Database,
    private readonly repository: WorkspaceRepository,
    private readonly authorization: TenantAuthorizationService,
  ) {}

  async summary(scope: TenantScope): Promise<WorkspaceView> {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const org = await this.repository.organisation(client, scope.tenantId);
      const tasks = await this.repository.tasks(client, scope);
      const evidence = await this.repository.evidenceInView(client, scope);
      const deliveries = await this.repository.deliveries(client, scope);
      return {
        name: org?.name ?? 'Workspace',
        role: scope.role,
        tasks: tasks.map(taskView),
        deliveries,
        evidence: evidence.map((event) => ({
          id: event.id,
          taskId: event.task_id,
          action: event.action,
          occurredAt: event.occurred_at.toISOString(),
          eventHash: event.event_hash,
          sequence: event.sequence,
        })),
      };
    });
  }

  async create(scope: TenantScope, dto: CreateTaskDto): Promise<TaskView> {
    if (scope.role !== WORKSPACE_ROLES.owner)
      throw new ForbiddenException('Only the workspace owner can create setup tasks.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      await this.repository.lockTenant(client, scope.tenantId);
      const prior = await this.repository.priorTask(client, dto.idempotencyKey);
      if (prior) return taskView(prior);
      const assignee = await this.repository.assignee(client, scope);
      if (!assignee) throw new ConflictException('No active colleague is available.');
      const id = randomUUID();
      const task = await this.repository.insertTask(
        client,
        scope,
        id,
        assignee.user_id,
        dto.template,
        dto.idempotencyKey,
      );
      await this.recordEvidence(client, scope, id, EVIDENCE_ACTIONS.created);
      const copy = taskMessage(dto.language);
      await this.repository.enqueueMessage(client, [
        scope.tenantId,
        randomUUID(),
        id,
        assignee.email,
        copy.subject,
        copy.body,
        dto.language,
      ]);
      return taskView({ ...task, assignee: assignee.display_name });
    });
  }

  async close(scope: TenantScope, id: string, version: number): Promise<TaskView> {
    if (scope.role === WORKSPACE_ROLES.viewer)
      throw new ForbiddenException('Reviewers have read-only access.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      await this.repository.lockTenant(client, scope.tenantId);
      const task = await this.repository.lockTask(client, id, scope.branchId);
      if (!task) throw new NotFoundException('Task is unavailable.');
      if (!mayClose(scope, task.assignee_id))
        throw new ForbiddenException('This task is assigned to another colleague.');
      if (task.status === TASK_STATUS.closed) return taskView(task);
      if (task.version !== version)
        throw new ConflictException('Task changed. Refresh before trying again.');
      await this.repository.closeTask(client, id);
      await this.recordEvidence(client, scope, id, EVIDENCE_ACTIONS.closed);
      return taskView({ ...task, status: TASK_STATUS.closed, version: task.version + 1 });
    });
  }

  private async recordEvidence(
    client: DatabaseClient,
    scope: TenantScope,
    taskId: string,
    action: string,
  ): Promise<void> {
    const previous = await this.repository.latestEvidence(client);
    const id = randomUUID();
    const sequence = Number(previous?.sequence ?? 0) + 1;
    const previousHash = previous?.event_hash ?? EVIDENCE_GENESIS;
    const occurredAt = new Date().toISOString();
    const hash = eventDigest({
      id,
      tenantId: scope.tenantId,
      sequence,
      taskId,
      actorId: scope.userId,
      action,
      previousHash,
      occurredAt,
    });
    await this.repository.appendEvidence(client, [
      scope.tenantId,
      id,
      sequence,
      taskId,
      scope.userId,
      action,
      previousHash,
      hash,
      occurredAt,
    ]);
  }
}
