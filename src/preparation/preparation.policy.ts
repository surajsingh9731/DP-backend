import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { PreparationKind, PreparationStatus, Role } from '@sahmati/contracts';
import type { PreparationActionDto } from './dto/preparation-action.dto.js';
import { PREPARATION_STATUS } from '../constants/preparation.constants.js';
export function assertPreparationEditor(kind: PreparationKind, role: Role): void {
  if (role === 'viewer' || (kind === 'contact' && role !== 'owner'))
    throw new ForbiddenException(
      'Only owners can prepare contacts; owners and staff can prepare templates.',
    );
}
export function nextPreparationStatus(
  status: PreparationStatus,
  dto: PreparationActionDto,
  role: Role,
): PreparationStatus {
  if (dto.action === 'submit') {
    if (status !== PREPARATION_STATUS.draft && status !== PREPARATION_STATUS.changesRequested)
      throw new ConflictException('Save a new draft before submitting this record again.');
    return PREPARATION_STATUS.inReview;
  }
  if (role !== 'owner')
    throw new ForbiddenException('Only owners can record internal review decisions.');
  if (status !== PREPARATION_STATUS.inReview)
    throw new ConflictException('The record is not awaiting internal review.');
  if (!dto.comment?.trim())
    throw new BadRequestException('Record a review comment without personal records.');
  if (dto.action === 'request_changes') return PREPARATION_STATUS.changesRequested;
  if (dto.internalOnlyAcknowledged !== true)
    throw new BadRequestException(
      'Acknowledge that this is internal review, not legal approval or contact verification.',
    );
  return PREPARATION_STATUS.reviewed;
}
