import type { Role } from './index.d.ts';
export type FollowupStatus =
  | 'pending'
  | 'unknown'
  | 'request_recorded'
  | 'completion_declared'
  | 'independently_reviewed'
  | 'blocked'
  | 'retention_exception_declared';
export type FollowupAction =
  | 'assign'
  | 'record_request'
  | 'declare_complete'
  | 'verify'
  | 'block'
  | 'retain'
  | 'retry'
  | 'reopen';
export interface FollowupLocation {
  key: string;
  kind: 'primary' | 'digital' | 'paper' | 'vendor' | 'unmapped';
  name: string;
  detail: string;
  mapping: 'declared' | 'unknown';
}
export interface FollowupAssignee {
  id: string;
  displayName: string;
  role: Exclude<Role, 'viewer'>;
}
export interface FollowupTask {
  id: string;
  receiptId: string;
  receiptHash: string;
  sessionId: string;
  noticeId: string;
  entryVersion: number;
  withdrawnPurposeIds: string[];
  location: FollowupLocation;
  status: FollowupStatus;
  version: number;
  responsibleRole: 'owner' | 'staff';
  assignee: FollowupAssignee | null;
  declaredBy: string | null;
  declaredEvidence: string[];
  retentionNote: string;
  updatedAt: string;
  mode: 'local-sample';
  applicability: 'unreviewed-candidate';
  mappingResolution?: {
    originalLocation: FollowupLocation;
    reviewedBy: string;
    reviewedAt: string;
    rationale: string;
    evidenceRefs: string[];
  };
  parentMappingTaskId?: string;
  mappedTaskIds?: string[];
}
export interface FollowupEvent {
  version: number;
  action: 'created' | 'mapping_resolved' | 'mapping_added' | FollowupAction;
  actorId: string;
  occurredAt: string;
  note: string;
  evidenceRefs: string[];
  previousHash: string | null;
  eventHash: string;
  task: FollowupTask;
}
export interface FollowupDetail extends FollowupTask {
  history: FollowupEvent[];
}
export interface FollowupActionInput {
  version: number;
  action: FollowupAction;
  note: string;
  evidenceRefs: string[];
  assigneeId?: string | null;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}
