// Shared request/response shapes between dp-backend and dp-frontend.
// Module A (account/access) — grows as later modules are rebuilt.

export type MembershipRole = "owner" | "staff" | "viewer";
export type AuthChannel = "email" | "whatsapp";

export interface ChallengeView {
  challengeId: string;
  channel: AuthChannel;
  expiresAt: string;
  /** Masked identifier for display, e.g. "owner@school.in" -> "o***@school.in". Never the raw code. */
  maskedIdentifier: string;
}

export interface SessionView {
  organisationId: string;
  organisationName: string;
  organisationSlug: string;
  role: MembershipRole;
  displayName: string;
}

export interface ApiErrorBody {
  message: string | string[];
  statusCode?: number;
}

/**
 * The one response envelope every endpoint in the API uses, success or
 * failure — a caller branches on `success` and never needs to know which
 * module answered to know where its payload or error lives.
 */
export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorBody;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

// ---------------------------------------------------------------------------
// Module B — data register
// ---------------------------------------------------------------------------

export type LegalBasis = "consent" | "legitimate_use";
export type RegisterEntryStatus = "draft" | "published";

export interface VendorReference {
  name: string;
  service: string;
}

export interface StorageReference {
  name: string;
  location: string;
  medium: "digital" | "paper";
}

export interface RegisterEntryView {
  id: string;
  categoryCode: string;
  categoryLabel: { en: string; hi: string };
  purposeEn: string;
  purposeHi: string;
  legalBasis: LegalBasis;
  /** The sector pack's default legal basis for this category, for the UI's "suggested" badge. */
  suggestedLegalBasis: LegalBasis;
  legalBasisOverridden: boolean;
  legalBasisReason: string | null;
  retentionDays: number;
  hasPaperRecords: boolean;
  vendorReferences: VendorReference[];
  storageReferences: StorageReference[];
  status: RegisterEntryStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterContextView {
  sectorPackCode: string;
  dataCategories: {
    code: string;
    label: { en: string; hi: string };
    suggestedLegalBasis: LegalBasis;
    suggestedRetentionDays: number;
  }[];
}

// ---------------------------------------------------------------------------
// Module C — notice builder
// ---------------------------------------------------------------------------

export type NoticeStatus = "draft" | "published";

export interface NoticeView {
  titleEn: string;
  titleHi: string;
  bodyEn: string;
  bodyHi: string;
  status: NoticeStatus;
  version: number;
  publishedAt: string | null;
}

/** What the public, no-login notice page returns — nothing internal, ever. */
export interface PublicNoticeView {
  available: boolean;
  organisationName?: string;
  titleEn?: string;
  titleHi?: string;
  bodyEn?: string;
  bodyHi?: string;
  publishedAt?: string;
}

// ---------------------------------------------------------------------------
// Shared participant (data principal) verification — no staff account, ever.
// ---------------------------------------------------------------------------

export interface ParticipantChallengeView {
  verificationId: string;
  channel: AuthChannel;
  expiresAt: string;
  maskedIdentifier: string;
}

export interface ParticipantSessionView {
  token: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Modules D/F — consent capture, ledger, withdrawal
// ---------------------------------------------------------------------------

export type ConsentDecision = "accept" | "decline";
export type ConsentReceiptKind = "choices_recorded" | "choices_withdrawn";

export interface ConsentOfferItem {
  registerEntryId: string;
  purposeEn: string;
  purposeHi: string;
  categoryLabel: { en: string; hi: string };
}

export interface ConsentChoiceInput {
  registerEntryId: string;
  decision: ConsentDecision;
}

export interface ConsentReceiptView {
  id: string;
  kind: ConsentReceiptKind;
  choices: ConsentChoiceInput[];
  receiptHash: string;
  previousReceiptHash: string | null;
  occurredAt: string;
}

export interface ConsentLedgerItemView extends ConsentReceiptView {
  identifierMasked: string;
}

// ---------------------------------------------------------------------------
// Module G — rights and grievance desk
// ---------------------------------------------------------------------------

export type RightsRequestKind =
  "access" | "correction" | "erasure" | "grievance" | "nomination";
export type RightsRequestStatus =
  "requested" | "under_review" | "responded" | "closed";

export interface RightsRequestView {
  id: string;
  kind: RightsRequestKind;
  details: string;
  status: RightsRequestStatus;
  version: number;
  autoAccessSummary: string | null;
  responseText: string | null;
  respondedAt: string | null;
  dueAt: string;
  submittedAt: string;
}

export interface RightsRequestAdminView extends RightsRequestView {
  identifierMasked: string;
}

// ---------------------------------------------------------------------------
// Module H — breach desk
// ---------------------------------------------------------------------------

export type BreachSeverity = "low" | "medium" | "high" | "critical";
export type BreachStatus =
  "open" | "contained" | "dpb_notified" | "principals_notified" | "closed";

export interface BreachIncidentView {
  id: string;
  title: string;
  description: string;
  discoveredAt: string;
  severity: BreachSeverity;
  affectedDataCategories: string[];
  affectedPrincipalsCount: number | null;
  status: BreachStatus;
  containmentNotes: string | null;
  dpbNotifiedAt: string | null;
  principalsNotifiedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Module I — retention / erasure
// ---------------------------------------------------------------------------

export type RetentionHoldStatus = "active" | "released";

export interface RetentionPreviewItemView {
  registerEntryId: string;
  purposeEn: string;
  categoryCode: string;
  dueAt: string;
  overdue: boolean;
  onHold: boolean;
}

export interface RetentionHoldView {
  id: string;
  registerEntryId: string;
  reason: string;
  status: RetentionHoldStatus;
  placedAt: string;
  releasedAt: string | null;
}

export interface RetentionActionView {
  id: string;
  registerEntryId: string;
  notes: string;
  executedAt: string;
}

// ---------------------------------------------------------------------------
// Module M — messaging (outbound notification queue)
// ---------------------------------------------------------------------------

export type MessageOutboxStatus = "pending" | "sent" | "failed";

export interface MessageOutboxView {
  id: string;
  recipient: string;
  template: string;
  status: MessageOutboxStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}
