/**
 * Retention contracts (source 013).
 *
 * Boundary notes that the UI relies on and must not be weakened:
 * - Nothing here deletes or redacts an underlying personal record. Previews are
 *   immutable dry-run snapshots only.
 * - `legalReviewStatus`-equivalent review stays internal; an owner's review is
 *   never a legal review.
 * - Day arithmetic is fixed 24-hour, not a legal or calendar rule.
 */

export type RetentionHoldScope = 'activity' | 'sample_record' | 'location';

/** draft -> submitted -> internally_reviewed, or retired from any non-retired state. */
export type RetentionPolicyStatus = 'draft' | 'submitted' | 'internally_reviewed' | 'retired';

export type RetentionHoldStatus = 'active' | 'released';

/** Outcomes a dry run may report. No value authorizes deletion. */
export type RetentionOutcome = 'held' | 'conflict' | 'unknown' | 'not_due' | 'candidate_review';

export type RetentionFreshness = 'matches_loaded_inputs' | 'stale' | 'source_unavailable';

export type RetentionIntegrity = 'match' | 'mismatch';

/** Keyset page. `nextAfter` is an opaque scope-bound cursor, not an authorization token. */
export interface RetentionPage<T> {
  items: T[];
  nextAfter: string | null;
}

export interface RetentionHistoryEvent {
  version: number;
  action: string;
  at: string;
  reason: string;
  actorId: string;
}

export interface RetentionRecordDetail<T> {
  record: T;
  history: RetentionHistoryEvent[];
}

export interface RetentionPolicy {
  id: string;
  entryId: string;
  entryVersion: number;
  name: string;
  durationDays: number;
  rationale: string;
  status: RetentionPolicyStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RetentionHold {
  id: string;
  entryId: string;
  scope: RetentionHoldScope;
  target: string | null;
  reason: string;
  status: RetentionHoldStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RetentionLocationRef {
  key: string;
  name: string;
}

export interface RetentionSampleRecordRef {
  id: string;
}

/** Minimized context for building a hold or a dry run. */
export interface RetentionContextView {
  entryId: string;
  entryVersion: number;
  locations: RetentionLocationRef[];
  sampleRecords: RetentionSampleRecordRef[];
}

export interface RetentionPreviewItem {
  key: string;
  sampleRecordId: string | null;
  location: { key: string; kind: string; name: string; detail: string };
  outcome: RetentionOutcome;
  reasons: RetentionReasonCode[];
  referenceAt: string | null;
  dueAt: string | null;
}

export type RetentionReasonCode =
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

export interface RetentionPreviewSummary {
  held: number;
  conflict: number;
  unknown: number;
  not_due: number;
  candidate_review: number;
}

/**
 * Immutable dry-run snapshot page. `integrity` compares this snapshot's own
 * recorded digest, not the authenticity of the underlying records.
 */
export interface RetentionPreviewPage {
  id: string;
  entryId: string;
  asOf: string;
  checkedAt: string;
  items: RetentionPreviewItem[];
  summary: RetentionPreviewSummary;
  nextCursor: string | null;
  freshness: RetentionFreshness;
  sourceVersions: { entry: number };
  inputHash: string;
  contentHash: string;
  integrity: RetentionIntegrity;
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

export interface EditRetentionPolicy {
  version: number;
  entryVersion: number;
  name: string;
  durationDays: number;
  rationale: string;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}

export interface RetentionPolicyAction {
  action: 'submit' | 'review' | 'retire';
  version: number;
  reason: string;
  syntheticOnlyAcknowledged: true;
  internalReviewAcknowledged?: true;
  idempotencyKey: string;
}

export interface CreateRetentionHold {
  entryId: string;
  scope: RetentionHoldScope;
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
