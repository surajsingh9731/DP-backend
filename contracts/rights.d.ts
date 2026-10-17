import type { FollowupLocation, FollowupAssignee, FollowupStatus } from './followups.d.ts';
export type RightsKind = 'access' | 'correction' | 'erasure' | 'grievance';
export type RightsStatus =
  'requested' | 'under_review' | 'action_declared' | 'blocked' | 'responded' | 'closed';
export type RightsAction =
  | 'assign'
  | 'begin_review'
  | 'declare_item'
  | 'verify_item'
  | 'block_item'
  | 'retain_item'
  | 'retry_item'
  | 'respond'
  | 'close'
  | 'reopen';
export interface RightsCorrection {
  fieldReference: string;
  requestedValue: string;
}
export interface RightsWorkItem {
  id: string;
  version: number;
  location: FollowupLocation;
  status: Exclude<FollowupStatus, 'request_recorded'>;
  declaredBy: string | null;
  declaredEvidence: string[];
  relatedFollowupTaskId?: string;
  relatedFollowupTaskVersion?: number;
}
export interface RightsResponse {
  id: string;
  at: string;
  language: 'en' | 'hi';
  text: string;
  resolution: 'complete' | 'partial' | 'blocked';
  unresolvedCount: number;
  requestVersion: number;
}
export interface RightsSource {
  noticeId: string;
  entryVersion: number;
  noticeLanguage: 'en' | 'hi';
  noticeTitle: string;
  offerId: string;
  sourceReceiptId: string | null;
}
export interface RightsRequest {
  id: string;
  sessionId: string;
  syntheticReference: string;
  kind: RightsKind;
  inputLanguage: 'en' | 'hi';
  details: string;
  correction?: RightsCorrection;
  source: RightsSource;
  status: RightsStatus;
  version: number;
  assignee: FollowupAssignee | null;
  workItems: RightsWorkItem[];
  responses: RightsResponse[];
  submittedAt: string;
  updatedAt: string;
  mode: 'local-sample';
  assurance: 'unverified-synthetic-adult';
}
export interface RightsEvent {
  version: number;
  action: 'submitted' | RightsAction;
  actorId: string;
  at: string;
  note: string;
  evidenceRefs: string[];
  previousHash: string | null;
  eventHash: string;
  request: RightsRequest;
}
export interface RightsDetail extends RightsRequest {
  history: RightsEvent[];
}
export interface RightsSummary {
  id: string;
  kind: RightsKind;
  status: RightsStatus;
  version: number;
  syntheticReference: string;
  assignee: FollowupAssignee | null;
  submittedAt: string;
}
export interface RightsProgress {
  pending: number;
  declared: number;
  reviewed: number;
  unknown: number;
  blocked: number;
  retained: number;
}
export interface ParticipantRightsRequest {
  id: string;
  kind: RightsKind;
  inputLanguage: 'en' | 'hi';
  details: string;
  correction?: RightsCorrection;
  source: Pick<RightsSource, 'noticeId' | 'entryVersion' | 'noticeLanguage' | 'noticeTitle'>;
  status: RightsStatus;
  version: number;
  responses: RightsResponse[];
  progress: RightsProgress;
  history: { status: RightsStatus; at: string; version: number }[];
  submittedAt: string;
  mode: 'local-sample';
  assurance: 'unverified-synthetic-adult';
}
export interface ParticipantRightsView {
  sessionId: string;
  syntheticReference: string;
  expiresAt: string;
  requests: ParticipantRightsRequest[];
}
export interface SubmitRightsInput {
  kind: RightsKind;
  inputLanguage: 'en' | 'hi';
  details: string;
  correction?: RightsCorrection;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
export interface RightsActionInput {
  version: number;
  action: RightsAction;
  note: string;
  evidenceRefs: string[];
  assigneeId?: string | null;
  workItemId?: string;
  response?: {
    language: 'en' | 'hi';
    text: string;
    resolution: RightsResponse['resolution'];
    reviewedResponseAcknowledged: true;
  };
  unresolvedAcknowledged?: boolean;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
