import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RightsRequest, TenantScope } from '@sahmati/contracts';
import { rightsProgress } from './rights.mapper.js';
import type { RightsActionDto } from './dto/rights.dto.js';
export function assertRightsOperator(scope: TenantScope, request?: RightsRequest): void {
  if (
    scope.role === 'viewer' ||
    (request && scope.role === 'staff' && request.assignee?.id !== scope.userId)
  )
    throw new ForbiddenException('Rights triage is limited to owners and assigned staff.');
}
export function transitionRights(
  request: RightsRequest,
  dto: RightsActionDto,
  scope: TenantScope,
): RightsRequest {
  assertRightsOperator(scope, request);
  if (request.version !== dto.version)
    throw new ConflictException('Request changed. Refresh before acting.');
  const owner = ['assign', 'verify_item', 'retain_item', 'respond', 'close', 'reopen'].includes(
    dto.action,
  );
  if (owner && scope.role !== 'owner')
    throw new ForbiddenException('Only owners can record this decision or participant response.');
  const itemAction = [
    'declare_item',
    'verify_item',
    'block_item',
    'retain_item',
    'retry_item',
  ].includes(dto.action);
  if (
    (dto.action !== 'assign' && dto.assigneeId !== undefined) ||
    (!itemAction && dto.workItemId !== undefined) ||
    (dto.action !== 'respond' && dto.response !== undefined) ||
    (dto.action !== 'close' && dto.unresolvedAcknowledged !== undefined)
  )
    throw new BadRequestException('Fields do not match the selected rights action.');
  const next: RightsRequest = {
    ...request,
    workItems: request.workItems.map((item) => ({ ...item })),
    responses: [...request.responses],
    version: request.version + 1,
    updatedAt: new Date().toISOString(),
  };
  if (dto.action === 'reopen') {
    if (!['responded', 'closed'].includes(request.status))
      throw new ConflictException('Only a responded or closed case can reopen.');
    next.status = 'under_review';
    return next;
  }
  if (dto.action === 'close') {
    if (request.status !== 'responded')
      throw new ConflictException('Record an owner-reviewed response before closure.');
    const unresolved = request.workItems.filter(
      (item) => item.status !== 'independently_reviewed',
    ).length;
    if (unresolved && dto.unresolvedAcknowledged !== true)
      throw new BadRequestException('Acknowledge unresolved work before closing this case.');
    next.status = 'closed';
    return next;
  }
  if (['responded', 'closed'].includes(request.status))
    throw new ConflictException('Reopen this case before changing its work.');
  if (dto.action === 'assign') return next;
  if (dto.action === 'begin_review') {
    if (!['requested', 'blocked'].includes(request.status))
      throw new ConflictException('Request is already under review.');
    next.status = 'under_review';
    return next;
  }
  if (!['under_review', 'action_declared', 'blocked'].includes(request.status))
    throw new ConflictException('Begin review before recording work or a response.');
  if (dto.action === 'respond') {
    if (!dto.response)
      throw new BadRequestException('An explicit participant response is required.');
    const progress = rightsProgress(request),
      unresolved = request.workItems.length - progress.reviewed;
    if (dto.response.resolution === 'complete' && unresolved)
      throw new ConflictException(
        'Unresolved, unknown, declared or retained work prevents a complete response.',
      );
    if (dto.response.resolution === 'partial' && (!progress.reviewed || !unresolved))
      throw new ConflictException(
        'Partial response needs both independently reviewed and unresolved work.',
      );
    if (
      dto.response.resolution === 'blocked' &&
      !(progress.blocked + progress.unknown + progress.retained)
    )
      throw new ConflictException('Record an unresolved blocker before a blocked response.');
    next.responses.push({
      id: randomUUID(),
      at: next.updatedAt,
      language: dto.response.language,
      text: dto.response.text.trim(),
      resolution: dto.response.resolution,
      unresolvedCount: unresolved,
      requestVersion: next.version,
    });
    next.status = 'responded';
    return next;
  }
  const index = next.workItems.findIndex((item) => item.id === dto.workItemId);
  if (index < 0) throw new BadRequestException('Select a work item belonging to this request.');
  const item = next.workItems[index]!;
  if (dto.action === 'block_item') {
    item.status = 'blocked';
    next.status = 'blocked';
    item.version++;
    return next;
  }
  if (dto.action === 'retry_item') {
    if (!['blocked', 'completion_declared', 'retention_exception_declared'].includes(item.status))
      throw new ConflictException('This item cannot retry from its current state.');
    if (item.status === 'retention_exception_declared' && scope.role !== 'owner')
      throw new ForbiddenException('Only owners can revisit retention exceptions.');
    item.status = item.location.mapping === 'unknown' ? 'unknown' : 'pending';
    item.declaredBy = null;
    item.declaredEvidence = [];
    item.version++;
    next.status = 'under_review';
    return next;
  }
  if (item.location.mapping === 'unknown')
    throw new ConflictException('Unknown places cannot be declared fulfilled or retained.');
  if (!dto.evidenceRefs.length)
    throw new BadRequestException('Synthetic manual evidence is required.');
  if (dto.action === 'verify_item') {
    if (item.status !== 'completion_declared')
      throw new ConflictException('Declare the item outcome before independent review.');
    if (item.declaredBy === scope.userId)
      throw new ForbiddenException('A different owner must review the declared outcome.');
    if (!dto.evidenceRefs.some((ref) => !item.declaredEvidence.includes(ref)))
      throw new BadRequestException('Independent review needs its own evidence reference.');
    item.status = 'independently_reviewed';
  } else if (dto.action === 'retain_item') {
    if (!['pending', 'completion_declared'].includes(item.status))
      throw new ConflictException('Retry the item before declaring a retention exception.');
    item.status = 'retention_exception_declared';
  } else if (dto.action === 'declare_item') {
    if (item.status !== 'pending')
      throw new ConflictException('Only a pending known item can be declared complete.');
    item.status = 'completion_declared';
    item.declaredBy = scope.userId;
    item.declaredEvidence = [...dto.evidenceRefs];
  } else throw new BadRequestException('Unsupported rights action.');
  item.version++;
  next.status = 'action_declared';
  return next;
}
