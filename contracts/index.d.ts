export type Role = 'owner' | 'staff' | 'viewer';
export interface TenantScope {
  tenantId: string;
  userId: string;
  branchId: string;
  role: Role;
}
export interface Membership {
  tenantId: string;
  name: string;
  branch: string;
  role: Role;
}
export interface SessionView {
  displayName: string;
  memberships: Membership[];
}
export interface TaskView {
  id: string;
  template: 'review_inventory';
  status: 'open' | 'closed';
  assignee: string;
  version: number;
  createdAt: string;
}
export interface EvidenceView {
  id: string;
  taskId: string;
  action: string;
  occurredAt: string;
  eventHash: string;
  sequence: string;
}
export interface WorkspaceView {
  name: string;
  role: Role;
  tasks: TaskView[];
  evidence: EvidenceView[];
  deliveries: { pending: number; sent: number; failed: number };
}
export interface MailView {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  deliveredAt: string;
}

export interface VendorReference {
  name: string;
  service: string;
}
export interface StorageReference {
  name: string;
  medium: 'digital' | 'paper';
  location: string;
}
export interface RegisterData {
  vendorReferences?: VendorReference[];
  storageReferences?: StorageReference[];
  hasPaperRecords?: boolean;
  name: string;
  purposeEn: string;
  purposeHi: string;
  dataCategories: string[];
  storageLocation: string;
  retentionNote: string;
  contact: string;
}
export interface RegisterView extends RegisterData {
  sourcePack?: SourcePack;
  id: string;
  version: number;
  status: 'draft';
  createdAt: string;
  updatedAt: string;
}
export interface RegisterRevision {
  version: number;
  data: RegisterData;
  createdAt: string;
}
export interface SourcePack {
  id: string;
  version: number;
  reviewStatus: 'unreviewed';
}
export interface NoticePreview {
  sourcePack?: SourcePack;
  entryId: string;
  version: number;
  language: 'en' | 'hi';
  status: 'unreviewed-draft';
  title: string;
  warning: string;
  body: string;
}

export interface SectorPackView {
  id: string;
  version: number;
  nameEn: string;
  nameHi: string;
  status: 'sample-draft' | 'planned-unreviewed';
  available: boolean;
  defaults: RegisterData | null;
}
export interface SetupView {
  version: number;
  organisationName: string;
  packId: string;
  packVersion: number;
  step: 1 | 2 | 3;
  draft: RegisterData | null;
  status: 'draft' | 'completed';
  registerEntryId: string | null;
  updatedAt: string;
}
export interface SetupResponse {
  setup: SetupView | null;
  packs: SectorPackView[];
}

export type NoticeReviewStatus = 'in_review' | 'changes_requested' | 'sample_published';
export type NoticeDecision = 'request_changes' | 'publish_sample';
export interface NoticeDecisionView {
  id: string;
  version: number;
  decision: NoticeDecision;
  comment: string | null;
  decidedAt: string;
  decidedBy: string;
}
export interface NoticeSnapshotView {
  preparationSource?: NoticePreparationSource;
  id: string;
  entryId: string;
  entryVersion: number;
  language: 'en' | 'hi';
  mode: 'local-sample';
  legalReviewStatus: 'unreviewed';
  sourcePack?: SourcePack;
  preview: NoticePreview;
  registerData: RegisterData;
  submittedAt: string;
  submittedBy: string;
  reviewVersion: number;
  status: NoticeReviewStatus;
  decisions: NoticeDecisionView[];
}
export interface NoticeReviewView extends NoticeSnapshotView {}
export interface CreateNoticeInput {
  preparation?: NoticePreparationInput;
  entryId: string;
  entryVersion: number;
  language: 'en' | 'hi';
  idempotencyKey: string;
}
export interface NoticeDecisionInput {
  version: number;
  decision: NoticeDecision;
  comment?: string;
  sampleOnlyAcknowledged?: true;
  idempotencyKey: string;
}

export type PreparationStatus = 'draft' | 'in_review' | 'changes_requested' | 'internally_reviewed';
export type PreparationKind = 'template' | 'contact';
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
export type PreparationData = TemplatePreparationData | ContactPreparationData;
export interface PreparationRevisionView {
  version: number;
  data: PreparationData;
  sourcePack?: SourcePack;
  status: PreparationStatus;
  contentHash: string;
  action: 'saved' | 'submit' | 'request_changes' | 'review_internal';
  comment: string | null;
  actorId: string;
  createdAt: string;
}
export interface PreparationRecordView {
  id: string;
  kind: PreparationKind;
  version: number;
  status: PreparationStatus;
  data: PreparationData;
  sourcePack?: SourcePack;
  contentHash: string;
  legalReviewStatus: 'unreviewed';
  contactVerification: 'unverified';
  updatedAt: string;
  history: PreparationRevisionView[];
}
export interface PreparationSaveBase {
  version: number;
  idempotencyKey: string;
}
export interface SaveTemplatePreparation extends PreparationSaveBase, TemplatePreparationData {}
export interface SaveContactPreparation extends PreparationSaveBase, ContactPreparationData {}
export interface PreparationActionInput extends PreparationSaveBase {
  action: 'submit' | 'request_changes' | 'review_internal';
  comment?: string;
  internalOnlyAcknowledged?: true;
}
export interface NoticePreparationInput {
  templateId: string;
  templateVersion: number;
  contactId: string;
  contactVersion: number;
}
export interface NoticePreparationSource extends NoticePreparationInput {
  reviewScope: 'internal-only';
  legalReviewStatus: 'unreviewed';
  contactVerification: 'unverified';
}

export * from './consent.d.ts';

export * from './followups.d.ts';

export * from './checks.d.ts';

export * from './rights.d.ts';

export * from './evidence.d.ts';

export * from './retention.d.ts';
