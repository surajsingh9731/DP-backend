import type { PreparationRecordView } from '@sahmati/contracts';
import type { PreparationRecordEntity, PreparationRevisionEntity } from './entities/index.js';
export function preparationView(
  row: PreparationRecordEntity,
  history: PreparationRevisionEntity[] = [],
): PreparationRecordView {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    status: row.status,
    data: row.data,
    ...(row.sourcePack ? { sourcePack: row.sourcePack } : {}),
    contentHash: row.contentHash,
    legalReviewStatus: 'unreviewed',
    contactVerification: 'unverified',
    updatedAt: row.updatedAt.toISOString(),
    history: history.map((revision) => ({
      version: revision.version,
      data: revision.data,
      ...(revision.sourcePack ? { sourcePack: revision.sourcePack } : {}),
      status: revision.status,
      contentHash: revision.contentHash,
      action: revision.action,
      comment: revision.comment,
      actorId: revision.actorId,
      createdAt: revision.createdAt.toISOString(),
    })),
  };
}
