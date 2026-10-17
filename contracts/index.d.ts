// Shared request/response shapes between dp-backend and dp-frontend.
// Module A (account/access) — grows as later modules are rebuilt.

export type MembershipRole = 'owner' | 'staff' | 'viewer';
export type AuthChannel = 'email' | 'whatsapp';

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

// ---------------------------------------------------------------------------
// Module B — data register
// ---------------------------------------------------------------------------

export type LegalBasis = 'consent' | 'legitimate_use';
export type RegisterEntryStatus = 'draft' | 'published';

export interface VendorReference {
  name: string;
  service: string;
}

export interface StorageReference {
  name: string;
  location: string;
  medium: 'digital' | 'paper';
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
