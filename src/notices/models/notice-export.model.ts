import type { NoticeSnapshotView } from '@sahmati/contracts';
export type NoticeExportSource = Pick<
  NoticeSnapshotView,
  'id' | 'entryVersion' | 'preview' | 'status' | 'mode' | 'legalReviewStatus'
>;
