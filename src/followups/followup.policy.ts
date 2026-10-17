import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { FollowupTask, TenantScope } from '@sahmati/contracts';
import type { FollowupActionDto } from './dto/followup.dto.js';
export function assertFollowupEditor(scope: TenantScope, task: FollowupTask): void {
  if (scope.role === 'viewer' || (scope.role === 'staff' && task.assignee?.id !== scope.userId))
    throw new ForbiddenException('Task action is unavailable for this role or assignee.');
}
export function applyFollowupAction(
  task: FollowupTask,
  dto: FollowupActionDto,
  scope: TenantScope,
): FollowupTask {
  assertFollowupEditor(scope, task);
  if (task.version !== dto.version)
    throw new ConflictException('Task version changed. Refresh before acting.');
  const next = { ...task, version: task.version + 1, updatedAt: new Date().toISOString() };
  if (dto.action !== 'assign' && dto.assigneeId !== undefined)
    throw new BadRequestException('Assignee is only accepted for assignment.');
  if (['assign', 'verify', 'retain', 'reopen'].includes(dto.action) && scope.role !== 'owner')
    throw new ForbiddenException('Only owners can record this review action.');
  if (dto.action === 'assign') return next;
  if (dto.action === 'block') {
    if (task.status === 'independently_reviewed')
      throw new ConflictException('Reopen reviewed task first.');
    next.status = 'blocked';
    return next;
  }
  if (dto.action === 'retry' || dto.action === 'reopen') {
    const allowed =
      dto.action === 'reopen'
        ? ['independently_reviewed']
        : ['blocked', 'request_recorded', 'completion_declared', 'retention_exception_declared'];
    if (!allowed.includes(task.status))
      throw new ConflictException(
        'This task cannot be retried or reopened from its current state.',
      );
    if (task.status === 'retention_exception_declared' && scope.role !== 'owner')
      throw new ForbiddenException('Only owners can revisit a retention exception.');
    return {
      ...next,
      status: task.location.mapping === 'unknown' ? 'unknown' : 'pending',
      declaredBy: null,
      declaredEvidence: [],
    };
  }
  if (task.location.mapping === 'unknown')
    throw new ConflictException(
      'Unmapped places cannot be marked requested, completed or verified.',
    );
  if (!dto.evidenceRefs.length)
    throw new BadRequestException('A synthetic manual evidence reference is required.');
  if (dto.action === 'verify') {
    if (task.status !== 'completion_declared')
      throw new ConflictException('Declare completion before independent review.');
    if (task.declaredBy === scope.userId)
      throw new ForbiddenException('A different owner must review the declared outcome.');
    if (!dto.evidenceRefs.some((ref) => !task.declaredEvidence.includes(ref)))
      throw new BadRequestException('Independent review needs its own evidence reference.');
    next.status = 'independently_reviewed';
    return next;
  }
  if (!['pending', 'request_recorded', 'completion_declared'].includes(task.status))
    throw new ConflictException('Retry this task before recording another outcome.');
  if (dto.action === 'retain') {
    next.status = 'retention_exception_declared';
    return next;
  }
  if (dto.action === 'record_request') {
    if (task.status === 'completion_declared')
      throw new ConflictException('Retry declared task before recording another request.');
    next.status = 'request_recorded';
    return next;
  }
  if (dto.action === 'declare_complete')
    return {
      ...next,
      status: 'completion_declared',
      declaredBy: scope.userId,
      declaredEvidence: [...dto.evidenceRefs],
    };
  throw new BadRequestException('Unsupported task action.');
}
