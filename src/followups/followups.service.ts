import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { FollowupDetail, FollowupTask, TenantScope } from '@sahmati/contracts';
import { Database } from '../database/database.service.js';
import { TenantAuthorizationService } from '../auth/tenant-authorization.service.js';
import { FollowupsRepository } from './followups.repository.js';
import { FollowupCreationService } from './followup-creation.service.js';
import { FollowupHistoryService } from './followup-history.service.js';
import { applyFollowupAction } from './followup.policy.js';
import { CreateFollowupsDto, FollowupActionDto } from './dto/followup.dto.js';
@Injectable()
export class FollowupsService {
  constructor(
    private readonly db: Database,
    private readonly authorization: TenantAuthorizationService,
    private readonly repository: FollowupsRepository,
    private readonly creation: FollowupCreationService,
    private readonly history: FollowupHistoryService,
  ) {}
  list(scope: TenantScope) {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      return (await this.repository.list(client, scope)).map((row) => row.data);
    });
  }
  assignees(scope: TenantScope) {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      return this.repository.assignees(client, scope);
    });
  }
  detail(scope: TenantScope, id: string): Promise<FollowupDetail> {
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const task = await this.repository.task(client, scope, id);
      return {
        ...task.data,
        history: (await this.repository.history(client, scope, id)).map((row) => row.data),
      };
    });
  }
  create(scope: TenantScope, dto: CreateFollowupsDto): Promise<FollowupTask[]> {
    if (scope.role !== 'owner')
      throw new ForbiddenException('Only owners can reconcile older withdrawal receipts.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        kind: 'create',
        receiptId: dto.receiptId,
      });
      if (command.response) return command.response as FollowupTask[];
      const result = await this.creation.ensure(client, scope, dto.receiptId);
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, result);
      return result;
    });
  }
  action(scope: TenantScope, id: string, dto: FollowupActionDto): Promise<FollowupTask> {
    if (scope.role === 'viewer')
      throw new ForbiddenException('Read-only role cannot change follow-up tasks.');
    return this.db.transaction(scope.tenantId, async (client) => {
      await this.authorization.assertCurrent(client, scope);
      const normalized = {
        version: dto.version,
        action: dto.action,
        note: dto.note.trim(),
        evidenceRefs: [...dto.evidenceRefs].sort(),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
      };
      const command = await this.repository.command(client, scope, dto.idempotencyKey, {
        kind: 'action',
        id,
        ...normalized,
      });
      const row = await this.repository.task(client, scope, id, true);
      if (command.response) return command.response as FollowupTask;
      let task = applyFollowupAction(row.data, dto, scope);
      if (dto.action === 'assign') {
        if (dto.assigneeId === undefined)
          throw new BadRequestException(
            'Select an assignee or explicitly return responsibility to the owner.',
          );
        const assignee =
          dto.assigneeId === null
            ? null
            : await this.repository.assignee(client, scope, dto.assigneeId);
        task = { ...task, assignee, responsibleRole: assignee?.role ?? 'owner' };
      }
      const previous = (await this.repository.history(client, scope, id))[0]?.data;
      await this.repository.update(client, scope, task);
      await this.history.append(
        client,
        scope,
        task,
        dto.action,
        normalized.note,
        normalized.evidenceRefs,
        previous?.eventHash ?? null,
      );
      await this.repository.saveCommand(client, scope, dto.idempotencyKey, command.hash, task);
      return task;
    });
  }
}
