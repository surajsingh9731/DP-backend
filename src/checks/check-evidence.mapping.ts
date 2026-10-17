import type {
  EvidenceDetail,
  TaskEvidenceReview,
  FollowupTask,
  CheckEvaluation,
} from '@sahmati/contracts';
import { reviewFreshness } from './checks.policy.js';
export function evidenceCheckFreshness(
  task: FollowupTask,
  review: TaskEvidenceReview | undefined,
  evaluation?: CheckEvaluation,
): EvidenceDetail['freshness'] {
  if (review && !Number.isFinite(Date.parse(review.validUntil))) return 'unknown';
  if (evaluation && evaluation.taskVersion !== task.version) return 'task_changed';
  if (evaluation && evaluation.reviewVersion !== (review?.version ?? 0)) return 'review_changed';
  return reviewFreshness(task, review);
}
