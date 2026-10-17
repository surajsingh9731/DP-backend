import type { FollowupTask } from './followups.d.ts';
export type CheckResult = 'pass' | 'fail' | 'unknown' | 'not_applicable';
export type ReviewFreshness = 'missing' | 'current' | 'expired' | 'task_changed';
export type CheckId =
  | 'receipt_link'
  | 'history_integrity'
  | 'location_reference'
  | 'applicability_review'
  | 'manual_assessment'
  | 'followup_state';
export interface TaskEvidenceReview {
  id: string;
  taskId: string;
  version: number;
  taskVersion: number;
  applicability: 'applicable' | 'not_applicable';
  result: CheckResult;
  rationale: string;
  evidenceRefs: string[];
  reviewerId: string;
  reviewedAt: string;
  validUntil: string;
  provenance: 'synthetic-manual-reference';
  authenticity: 'not-authenticated';
}
export interface LocalCheck {
  id: CheckId;
  result: CheckResult;
  reason: string;
  provenance: 'local-record' | 'synthetic-manual-reference';
  freshness: ReviewFreshness;
  references: string[];
}
export interface CheckEvaluation {
  id: string;
  taskId: string;
  taskVersion: number;
  reviewVersion: number;
  computedAt: string;
  computedBy: string;
  checks: LocalCheck[];
  contentHash: string;
  mode: 'local-sample';
}
export interface CheckDetail {
  task: FollowupTask;
  reviews: TaskEvidenceReview[];
  evaluations: CheckEvaluation[];
  freshness: ReviewFreshness;
  latestEvaluationCurrent: boolean;
  serverTime: string;
}
export interface ReviewEvidenceInput {
  taskVersion: number;
  reviewVersion: number;
  applicability: 'applicable' | 'not_applicable';
  result: CheckResult;
  rationale: string;
  evidenceRefs: string[];
  validForMinutes: number;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
export interface ResolveLocationInput {
  taskVersion: number;
  kind: 'primary' | 'digital' | 'paper' | 'vendor';
  name: string;
  detail: string;
  rationale: string;
  evidenceRefs: string[];
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
export interface MappingResult {
  parent: FollowupTask;
  child: FollowupTask | null;
}
export interface EvaluateChecksInput {
  taskVersion: number;
  reviewVersion: number;
  idempotencyKey: string;
}
