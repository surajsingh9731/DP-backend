import { BadRequestException, ConflictException } from '@nestjs/common';
import type { FollowupTask, TaskEvidenceReview, ReviewFreshness } from '@sahmati/contracts';
import type { ReviewEvidenceDto } from './dto/checks.dto.js';
export function reviewFreshness(
  task: FollowupTask,
  review: TaskEvidenceReview | undefined,
  now = new Date(),
): ReviewFreshness {
  if (!review) return 'missing';
  if (task.version !== review.taskVersion) return 'task_changed';
  return Date.parse(review.validUntil) <= now.getTime() ? 'expired' : 'current';
}
export function assertCheckVersions(
  task: FollowupTask,
  review: TaskEvidenceReview | undefined,
  taskVersion: number,
  reviewVersion: number,
): void {
  if (task.version !== taskVersion || (review?.version ?? 0) !== reviewVersion)
    throw new ConflictException('Task or review changed. Refresh before recording.');
}
export function assertReviewDecision(
  task: FollowupTask,
  dto: Pick<ReviewEvidenceDto, 'applicability' | 'result'>,
): void {
  if ((dto.applicability === 'not_applicable') !== (dto.result === 'not_applicable'))
    throw new BadRequestException(
      'Not-applicable result requires an explicit not-applicable review.',
    );
  if (
    task.location.mapping === 'unknown' &&
    (dto.applicability === 'not_applicable' || dto.result !== 'unknown')
  )
    throw new ConflictException(
      'Unknown coverage cannot be passed or dismissed. Resolve a specific location; residual unknown coverage remains.',
    );
}
