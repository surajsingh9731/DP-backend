/**
 * @sahmati/contracts
 *
 * Shared, type-only request/response shapes between the NestJS backend and the
 * Angular frontend. Nothing here is executable — no classes, no decorators, no
 * runtime values. The backend's DTOs and entities are the source of truth; this
 * file must stay structurally assignable from them.
 *
 * Status language throughout is intentionally narrow: a status such as
 * `internally_reviewed` or `legalReviewStatus: 'unreviewed'` records what this
 * local tool observed, never a legal or production guarantee.
 */

export * from './retention';

// ---------------------------------------------------------------------------
// Session / auth / tenancy
// ---------------------------------------------------------------------------

export type TenantRole = 'owner' | 'staff' | 'viewer';

export interface Membership {
  tenantId: string;
  name: string;
  branch: string;
  role: TenantRole;
}

export interface SessionView {
  displayName: string;
  memberships: Membership[];
}

// ---------------------------------------------------------------------------
// Workspace / tasks / mail
// ---------------------------------------------------------------------------

export type TaskStatus = 'open' | 'closed';
export type TaskTemplate = 'review_inventory';

export interface TaskView {
  id: string;
  template: TaskTemplate;
  status: TaskStatus;
  assignee: string | null;
  version: number;
  createdAt: string;
}

export interface WorkspaceEvidenceEvent {
  id: string;
  taskId: string;
  action: string;
  occurredAt: string;
  eventHash: string;
  sequence: string;
}

export interface WorkspaceDeliveries {
  pending: number;
  sent: number;
  failed: number;
}

export interface WorkspaceView {
  name: string;
  role: TenantRole;
  tasks: TaskView[];
  evidence: WorkspaceEvidenceEvent[];
  deliveries: WorkspaceDeliveries;
}

export interface MailView {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  deliveredAt: string;
}

// ---------------------------------------------------------------------------
// Data register (module B)
// ---------------------------------------------------------------------------

export interface RegisterVendorReference {
  name: string;
  service: string;
}

export interface RegisterStorageReference {
  name: string;
  medium: 'digital' | 'paper';
  location: string;
}

/** Caller-supplied register fields. Server validation is authoritative. */
export interface RegisterData {
  name: string;
  purposeEn: string;
  purposeHi: string;
  dataCategories: string[];
  storageLocation: string;
  retentionNote: string;
  contact: string;
  vendorReferences?: RegisterVendorReference[];
  storageReferences?: RegisterStorageReference[];
  hasPaperRecords?: boolean;
}

export type RegisterSourcePackReviewStatus = 'unreviewed';

export interface RegisterSourcePack {
  id: string;
  version: number;
  reviewStatus: RegisterSourcePackReviewStatus;
}

export type RegisterStatus = 'draft';

export interface RegisterView extends RegisterData {
  id: string;
  version: number;
  status: RegisterStatus;
  createdAt: string;
  updatedAt: string;
  sourcePack?: RegisterSourcePack | null;
}

export interface RegisterRevision {
  version: number;
  createdAt: string;
  data: RegisterData;
}

export type NoticePreviewStatus = 'unreviewed-draft';

export interface NoticePreview {
  entryId: string;
  version: number;
  language: 'en' | 'hi';
  status: NoticePreviewStatus;
  title: string;
  warning: string;
  body: string;
  sourcePack?: RegisterSourcePack | null;
}

// ---------------------------------------------------------------------------
// Guided setup (module A/B)
// ---------------------------------------------------------------------------

export type SectorPackStatus = 'sample-draft' | 'planned-unreviewed';

export interface SectorPackView {
  id: string;
  version: number;
  nameEn: string;
  nameHi: string;
  status: SectorPackStatus;
  available: boolean;
  defaults: RegisterData | null;
}

export type SetupStatus = 'draft' | 'completed';

export interface SetupView {
  version: number;
  organisationName: string;
  packId: string;
  packVersion: number;
  step: 1 | 2 | 3;
  draft: RegisterData | null;
  status: SetupStatus;
  registerEntryId: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Preparation: internally reviewed templates / contacts (module C support)
// ---------------------------------------------------------------------------

export type PreparationKind = 'template' | 'contact';

/** draft -> submitted -> in_review -> internally_reviewed, or changes_requested back to draft. */
export type PreparationStatus = 'draft' | 'in_review' | 'internally_reviewed' | 'changes_requested';

export interface TemplatePreparationData {
  title: string;
  body: string;
  language: 'en' | 'hi';
  sourceKind: 'custom-draft' | 'education-sample';
}

export interface ContactPreparationData {
  displayName: string;
  email: string;
}

export type PreparationLegalReviewStatus = 'unreviewed';
export type PreparationContactVerification = 'unverified';

/** A full immutable snapshot of the record as it stood after this action. */
export interface PreparationHistoryEvent {
  version: number;
  action: PreparationActionInput['action'] | 'saved';
  status: PreparationStatus;
  data: TemplatePreparationData | ContactPreparationData;
  contentHash: string;
  comment: string;
  actorId: string;
  createdAt: string;
}

export interface PreparationRecordView {
  id: string;
  kind: PreparationKind;
  version: number;
  status: PreparationStatus;
  data: TemplatePreparationData | ContactPreparationData;
  legalReviewStatus: PreparationLegalReviewStatus;
  contactVerification: PreparationContactVerification;
  contentHash: string;
  updatedAt: string;
  sourcePack?: RegisterSourcePack | null;
  history: PreparationHistoryEvent[];
}

export type SaveTemplatePreparation = TemplatePreparationData & {
  version: number;
  idempotencyKey: string;
};

export type SaveContactPreparation = ContactPreparationData & {
  version: number;
  idempotencyKey: string;
};

export interface PreparationActionInput {
  action: 'submit' | 'review_internal' | 'request_changes';
  version: number;
  comment?: string;
  internalOnlyAcknowledged?: true;
  idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Notices (module C)
// ---------------------------------------------------------------------------

export type NoticeSnapshotStatus = 'in_review' | 'sample_published' | 'changes_requested';
export type NoticeLegalReviewStatus = 'unreviewed';

export interface NoticePreparationSource {
  templateId: string;
  templateVersion: number;
  contactId: string;
  contactVersion: number;
  reviewScope: 'internal-only';
  legalReviewStatus: NoticeLegalReviewStatus;
  contactVerification: 'unverified';
}

export interface NoticeDecisionRecord {
  id: string;
  version: number;
  decision: 'publish_sample' | 'request_changes';
  comment: string;
  decidedAt: string;
  actorId: string;
}

export interface NoticeSnapshotView {
  id: string;
  entryId: string;
  entryVersion: number;
  language: 'en' | 'hi';
  mode: 'local-sample';
  legalReviewStatus: NoticeLegalReviewStatus;
  sourcePack?: RegisterSourcePack | null;
  preview: NoticePreview;
  registerData: RegisterData;
  submittedAt: string;
  submittedBy: string;
  reviewVersion: number;
  status: NoticeSnapshotStatus;
  decisions: NoticeDecisionRecord[];
  preparationSource?: NoticePreparationSource;
}

export interface NoticePreparationInput {
  templateId: string;
  templateVersion: number;
  contactId: string;
  contactVersion: number;
}

export interface CreateNoticeInput {
  entryId: string;
  entryVersion: number;
  language: 'en' | 'hi';
  idempotencyKey: string;
  preparation?: NoticePreparationInput;
}

export interface NoticeDecisionInput {
  version: number;
  decision: 'publish_sample' | 'request_changes';
  comment?: string;
  sampleOnlyAcknowledged?: true;
  idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Consent sandbox (module D)
// ---------------------------------------------------------------------------

export interface ConsentPurpose {
  id: string;
  labelEn: string;
  labelHi: string;
}

export interface ConsentOfferNotice {
  id: string;
  entryVersion: number;
  language: 'en' | 'hi';
  title: string;
  body: string;
  warning: string;
}

export interface ConsentOffer {
  id: string;
  version: number;
  catalogHash: string;
  createdAt: string;
  notice: ConsentOfferNotice;
  purposes: ConsentPurpose[];
}

export interface ConsentParticipant {
  id: string;
  offer: ConsentOffer;
  syntheticReference: string;
  expiresAt: string;
  version: number;
  receipts: ConsentReceipt[];
}

export type ConsentDecision = 'allow' | 'decline';

export interface ConsentChoice {
  purposeId: string;
  decision: ConsentDecision;
}

export type ConsentReceiptKind = 'choices_recorded' | 'choices_withdrawn';
export type ConsentReceiptMode = 'local-sample';
export type ConsentReceiptAssurance = 'unverified-synthetic-adult';
export type ConsentLegalReviewStatus = 'unreviewed';
export type ConsentContactVerification = 'unverified';
export type ConsentDeletionStatus = 'not-performed';

export interface ConsentReceipt {
  id: string;
  sessionId: string;
  syntheticReference: string;
  offer: ConsentOffer;
  version: number;
  kind: ConsentReceiptKind;
  choices: ConsentChoice[];
  interfaceLanguage: 'en' | 'hi';
  occurredAt: string;
  previousReceiptHash: string | null;
  receiptHash: string;
  mode: ConsentReceiptMode;
  assurance: ConsentReceiptAssurance;
  legalReviewStatus: ConsentLegalReviewStatus;
  contactVerification: ConsentContactVerification;
  deletionStatus: ConsentDeletionStatus;
}

export interface CreateConsentOffer {
  noticeId: string;
  purposes: ConsentPurpose[];
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}

export interface SubmitConsentChoices {
  offerId: string;
  offerVersion: number;
  catalogHash: string;
  choices: ConsentChoice[];
  interfaceLanguage: 'en' | 'hi';
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}

export interface WithdrawConsentChoices {
  version: number;
  purposeIds: string[];
  interfaceLanguage: 'en' | 'hi';
  idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Shared location / mapping (checks, followups, rights)
// ---------------------------------------------------------------------------

export type LocationKind = 'primary' | 'digital' | 'paper' | 'vendor' | 'unmapped';
export type LocationMapping = 'declared' | 'unknown';

export interface LocationRef {
  key: string;
  kind: LocationKind;
  name: string;
  detail: string;
  mapping: LocationMapping;
}

// ---------------------------------------------------------------------------
// Withdrawal follow-ups (module F)
// ---------------------------------------------------------------------------

export type FollowupStatus =
  | 'unknown'
  | 'pending'
  | 'blocked'
  | 'request_recorded'
  | 'completion_declared'
  | 'retention_exception_declared'
  | 'independently_reviewed';

export type FollowupApplicability = 'unreviewed-candidate';
export type FollowupMode = 'local-sample';
export type FollowupResponsibleRole = 'owner' | 'staff';

export interface FollowupTask {
  id: string;
  receiptId: string;
  receiptHash: string;
  sessionId: string;
  noticeId: string;
  entryVersion: number;
  withdrawnPurposeIds: string[];
  location: LocationRef;
  status: FollowupStatus;
  version: number;
  responsibleRole: FollowupResponsibleRole;
  assignee: FollowupAssignee | null;
  declaredBy: string | null;
  declaredEvidence: string[];
  retentionNote: string;
  updatedAt: string;
  mode: FollowupMode;
  applicability: FollowupApplicability;
  /** Set on a task created by resolving a parent's unknown/unmapped location. */
  mappingResolution?: { parentTaskId: string } | null;
  /** Set on the original task once one or more mapped child tasks exist for it. */
  mappedTaskIds?: string[] | null;
}

export type FollowupAction =
  | 'assign'
  | 'block'
  | 'retry'
  | 'record_request'
  | 'declare_complete'
  | 'retain'
  | 'verify'
  | 'reopen';

export interface FollowupEvent {
  version: number;
  action: FollowupAction | 'created';
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

export interface FollowupAssignee {
  id: string;
  displayName: string;
  role: FollowupResponsibleRole;
}

export interface FollowupActionInput {
  action: FollowupAction;
  version: number;
  note: string;
  evidenceRefs: string[];
  assigneeId?: string | null;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Local checks (module K)
// ---------------------------------------------------------------------------

export type CheckResult = 'pass' | 'fail' | 'unknown' | 'not_applicable';
export type CheckApplicability = 'applicable' | 'not_applicable';
export type CheckReviewProvenance = 'synthetic-manual-reference';
export type CheckEvaluationProvenance = 'synthetic-manual-reference' | 'local-record';
export type CheckAuthenticity = 'not-authenticated';
export type CheckFreshness = 'current' | 'stale' | 'missing' | 'task_changed';

export interface TaskEvidenceReview {
  id: string;
  taskId: string;
  version: number;
  taskVersion: number;
  applicability: CheckApplicability;
  result: CheckResult;
  rationale: string;
  evidenceRefs: string[];
  reviewerId: string;
  reviewedAt: string;
  validUntil: string;
  provenance: CheckReviewProvenance;
  authenticity: CheckAuthenticity;
}

export type CheckId =
  | 'receipt_link'
  | 'history_integrity'
  | 'location_reference'
  | 'applicability_review'
  | 'manual_assessment'
  | 'followup_state';

export interface CheckEvaluationItem {
  id: CheckId;
  result: CheckResult;
  reason: string;
  provenance: CheckEvaluationProvenance;
  freshness: CheckFreshness;
  references: string[];
}

export interface CheckEvaluation {
  id: string;
  taskId: string;
  taskVersion: number;
  reviewVersion: number;
  computedAt: string;
  computedBy: string;
  checks: CheckEvaluationItem[];
  contentHash: string;
  mode: 'local-sample';
}

export interface CheckDetail {
  task: FollowupTask;
  reviews: TaskEvidenceReview[];
  evaluations: CheckEvaluation[];
  freshness: CheckFreshness;
  latestEvaluationCurrent: boolean;
  serverTime: string;
}

export interface MappingResult {
  parent: FollowupTask;
  child: FollowupTask;
}

export interface ReviewEvidenceInput {
  taskVersion: number;
  reviewVersion: number;
  applicability: CheckApplicability;
  result: CheckResult;
  rationale: string;
  evidenceRefs: string[];
  validForMinutes: number;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}

export interface ResolveLocationInput {
  taskVersion: number;
  kind: Exclude<LocationKind, 'unmapped'>;
  name: string;
  detail: string;
  rationale: string;
  evidenceRefs: string[];
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}

export interface EvaluateChecksInput {
  taskVersion: number;
  reviewVersion: number;
  idempotencyKey: string;
}

// ---------------------------------------------------------------------------
// Rights (module G)
// ---------------------------------------------------------------------------

export type RightsKind = 'access' | 'correction' | 'erasure' | 'grievance';

export type RightsStatus = 'requested' | 'under_review' | 'blocked' | 'responded' | 'closed';

export type RightsWorkItemStatus =
  | 'pending'
  | 'unknown'
  | 'declared'
  | 'independently_reviewed'
  | 'blocked'
  | 'retained';

export type RightsMode = 'local-sample';
export type RightsAssurance = 'unverified-synthetic-adult';

export interface RightsAssignee {
  id: string;
  displayName: string;
}

export interface RightsCorrection {
  fieldReference: string;
  requestedValue: string;
}

export interface RightsSourceAdmin {
  noticeId: string;
  entryVersion: number;
  noticeLanguage: 'en' | 'hi';
  noticeTitle: string;
  offerId: string;
  sourceReceiptId: string | null;
}

export interface RightsSourcePublic {
  noticeId: string;
  entryVersion: number;
  noticeLanguage: 'en' | 'hi';
  noticeTitle: string;
}

export interface RightsWorkItem {
  id: string;
  version: number;
  location: LocationRef;
  status: RightsWorkItemStatus;
  declaredBy: string | null;
  declaredEvidence: string[];
  /** Set when this work item tracks a withdrawal follow-up task for the same location. */
  relatedFollowupTaskId?: string | null;
}

/** Simple status timeline shown on the public (participant) side. */
export interface RightsHistoryEvent {
  status: RightsStatus;
  at: string;
  version: number;
}

/** Full immutable internal audit entry shown to staff/owner triage. */
export interface RightsAuditEvent {
  version: number;
  action: RightsAction | 'submitted';
  note: string;
  actorId: string;
  at: string;
  evidenceRefs: string[];
  previousHash: string | null;
  eventHash: string;
}

export interface RightsResponseAdmin {
  id: string;
  at: string;
  language: 'en' | 'hi';
  text: string;
  resolution: 'complete' | 'partial' | 'blocked';
  unresolvedCount: number;
  requestVersion: number;
}

export interface RightsDetail {
  id: string;
  sessionId: string;
  syntheticReference: string;
  kind: RightsKind;
  inputLanguage: 'en' | 'hi';
  details: string;
  correction?: RightsCorrection;
  source: RightsSourceAdmin;
  status: RightsStatus;
  version: number;
  assignee: RightsAssignee | null;
  workItems: RightsWorkItem[];
  responses: RightsResponseAdmin[];
  submittedAt: string;
  updatedAt: string;
  mode: RightsMode;
  assurance: RightsAssurance;
  history: RightsAuditEvent[];
}

export interface RightsSummary {
  id: string;
  kind: RightsKind;
  syntheticReference: string;
  status: RightsStatus;
  version: number;
  assignee: RightsAssignee | null;
  submittedAt: string;
  updatedAt: string;
}

export type RightsRequest = RightsDetail;

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

export interface RightsActionInput {
  action: RightsAction;
  version: number;
  note: string;
  evidenceRefs: string[];
  assigneeId?: string | null;
  workItemId?: string;
  response?: {
    language: 'en' | 'hi';
    text: string;
    resolution: 'complete' | 'partial' | 'blocked';
    reviewedResponseAcknowledged: true;
  };
  unresolvedAcknowledged?: boolean;
  syntheticOnlyAcknowledged: true;
  idempotencyKey: string;
}

export type RightsResponsePublic = RightsResponseAdmin;

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
  source: RightsSourcePublic;
  status: RightsStatus;
  version: number;
  responses: RightsResponsePublic[];
  progress: RightsProgress;
  history: RightsHistoryEvent[];
  submittedAt: string;
  mode: RightsMode;
  assurance: RightsAssurance;
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

// ---------------------------------------------------------------------------
// Evidence hub (module L support)
// ---------------------------------------------------------------------------

export type EvidenceKind =
  | 'notice'
  | 'notice_decision'
  | 'consent'
  | 'withdrawal'
  | 'followup'
  | 'check_review'
  | 'check_evaluation'
  | 'rights';

export type EvidenceProvenance = 'recorded' | 'manual' | 'computed';

export interface EvidenceFilters {
  q?: string;
  kind?: string;
  provenance?: string;
  limit?: number;
  cursor?: string;
}

export interface EvidenceItem {
  key: string;
  kind: EvidenceKind;
  id: string;
  sourceId: string;
  version: number;
  at: string;
  action: string;
  status: string;
  provenance: EvidenceProvenance;
}

export type EvidenceSearchScope = 'identifiers-and-controlled-metadata';

export interface EvidencePage {
  items: EvidenceItem[];
  nextCursor: string | null;
  asOf: string;
  serverTime: string;
  searchScope: EvidenceSearchScope;
}

export type EvidenceFreshness = 'current' | 'source_changed';

export interface EvidenceIntegrity {
  digest: 'match' | 'mismatch';
  previous: 'linked' | 'none';
  scope: 'single-event-and-previous-reference';
}

export type EvidenceFactLabel =
  | 'remaining'
  | 'sourceVersion'
  | 'recordVersion'
  | 'coverage'
  | 'language'
  | 'result';

export interface EvidenceFact {
  label: EvidenceFactLabel;
  value: string | number;
}

export type EvidenceLinkLabel = EvidenceKind | 'source';

export interface EvidenceLink {
  label: EvidenceLinkLabel;
  state: 'available' | 'unavailable';
  path?: string;
}

export interface EvidenceDetail {
  item: EvidenceItem;
  freshness: EvidenceFreshness;
  integrity: EvidenceIntegrity;
  facts: EvidenceFact[];
  links: EvidenceLink[];
  validUntil?: string | null;
  serverTime: string;
  mode: 'local-sample';
}
