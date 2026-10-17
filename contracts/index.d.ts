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
