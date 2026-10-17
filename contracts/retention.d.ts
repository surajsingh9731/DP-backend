import type { FollowupLocation, ConsentReceipt, FollowupStatus, RightsStatus } from './index.d.ts';
export interface RetentionPolicy {
  id: string;
  entryId: string;
  entryVersion: number;
  version: number;
  name: string;
  durationDays: number;
  rationale: string;
  status: 'draft' | 'submitted' | 'internally_reviewed' | 'retired';
  updatedAt: string;
  legalReview: 'unreviewed';
  mode: 'local-sample';
}
export interface RetentionHold {
  id: string;
  entryId: string;
  version: number;
  scope: 'activity' | 'sample_record' | 'location';
  target: string | null;
  reason: string;
  status: 'active' | 'released';
  updatedAt: string;
  mode: 'local-sample';
}
export interface RetentionEvent<T> {
  version: number;
  action: string;
  actorId: string;
  at: string;
  reason: string;
  previousHash: string | null;
  eventHash: string;
  record: T;
}
export interface RetentionRecordDetail<T> {
  record: T;
  history: RetentionEvent<T>[];
}
export type RetentionOutcome = 'held' | 'conflict' | 'unknown' | 'not_due' | 'candidate_review';
export type RetentionReason =
  | 'active_hold'
  | 'policy_unreviewed'
  | 'policy_conflict'
  | 'source_version_changed'
  | 'unknown_coverage'
  | 'missing_reference_time'
  | 'rights_review'
  | 'withdrawal_review'
  | 'followup_review'
  | 'retention_exception_review';
export interface RetentionCandidate {
  key: string;
  sampleRecordId: string | null;
  receiptId: string | null;
  noticeId: string | null;
  location: FollowupLocation;
  referenceAt: string | null;
  dueAt: string | null;
  outcome: RetentionOutcome;
  reasons: RetentionReason[];
  holdIds: string[];
}
export interface RetentionInputs {
  entry: { id: string; version: number; locations: FollowupLocation[] };
  policies: Pick<RetentionPolicy, 'id' | 'version' | 'entryVersion' | 'durationDays' | 'status'>[];
  holds: Pick<RetentionHold, 'id' | 'version' | 'scope' | 'target' | 'status'>[];
  receipts: {
    sampleRecordId: string | null;
    receipt:
      | (Pick<
          ConsentReceipt,
          'id' | 'sessionId' | 'version' | 'kind' | 'occurredAt' | 'receiptHash'
        > & { notice: { id: string; entryVersion: number } })
      | null;
    locations: FollowupLocation[];
  }[];
  rights: {
    id: string;
    version: number;
    sessionId: string;
    status: RightsStatus;
    unresolvedCount: number;
  }[];
  followups: { id: string; version: number; sessionId: string; status: FollowupStatus }[];
}
export interface RetentionContextView {
  entryId: string;
  entryVersion: number;
  sampleRecords: { id: string; receiptId: string | null; referenceAt: string | null }[];
  locations: FollowupLocation[];
  coverage: 'bounded-synthetic-sources';
}
export interface RetentionSnapshot {
  id: string;
  entryId: string;
  asOf: string;
  createdAt: string;
  createdBy: string;
  inputHash: string;
  contentHash: string;
  inputs: RetentionInputs;
  candidates: RetentionCandidate[];
  mode: 'local-sample';
  execution: 'not-available';
}
export interface RetentionPreviewPage {
  id: string;
  entryId: string;
  asOf: string;
  createdAt: string;
  inputHash: string;
  contentHash: string;
  integrity: 'match' | 'mismatch';
  freshness: 'matches_loaded_inputs' | 'stale' | 'source_unavailable';
  checkedAt: string;
  items: RetentionCandidate[];
  nextCursor: string | null;
  candidateCount: number;
  summary: Record<RetentionOutcome, number>;
  sourceVersions: {
    entry: number;
    policies: { id: string; version: number; status: RetentionPolicy['status'] }[];
    holds: { id: string; version: number; status: RetentionHold['status'] }[];
  };
  execution: 'not-available';
}
export interface RetentionPage<T> {
  items: T[];
  nextAfter: string | null;
}
export interface CreateRetentionPolicy {
  entryId: string;
  entryVersion: number;
  name: string;
  durationDays: number;
  rationale: string;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
export interface EditRetentionPolicy extends Omit<CreateRetentionPolicy, 'entryId'> {
  version: number;
}
export interface RetentionPolicyAction {
  version: number;
  action: 'submit' | 'review' | 'retire';
  reason: string;
  internalReviewAcknowledged?: true;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
export interface CreateRetentionHold {
  entryId: string;
  scope: RetentionHold['scope'];
  target?: string;
  reason: string;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
export interface ReleaseRetentionHold {
  version: number;
  reason: string;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
export interface CreateRetentionPreview {
  entryId: string;
  asOf: string;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
