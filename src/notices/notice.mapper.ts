import type { NoticeSnapshotView } from '@sahmati/contracts';
import type {
  NoticeSnapshotEntity,
  NoticeReviewEntity,
  NoticeDecisionEntity,
} from './entities/index.js';
export function noticeView(
  snapshot: NoticeSnapshotEntity,
  review: NoticeReviewEntity,
  decisions: NoticeDecisionEntity[],
): NoticeSnapshotView {
  return {
    id: snapshot.id,
    ...(snapshot.preparationSource ? { preparationSource: snapshot.preparationSource } : {}),
    entryId: snapshot.entryId,
    entryVersion: snapshot.entryVersion,
    language: snapshot.language,
    mode: snapshot.mode,
    legalReviewStatus: snapshot.legalReviewStatus,
    ...(snapshot.sourcePack ? { sourcePack: snapshot.sourcePack } : {}),
    preview: snapshot.preview,
    registerData: snapshot.registerData,
    submittedAt: snapshot.submittedAt.toISOString(),
    submittedBy: snapshot.submittedBy,
    reviewVersion: review.version,
    status: review.status,
    decisions: decisions.map((row) => ({
      id: row.id,
      version: row.version,
      decision: row.decision,
      comment: row.comment,
      decidedAt: row.decidedAt.toISOString(),
      decidedBy: row.decidedBy,
    })),
  };
}
