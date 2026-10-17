export const CONSENT_LIMITS = { purposes: 10, label: 240, list: 50, sessionSeconds: 1200 } as const;
export const CONSENT_COOKIE = 'sahmati_sample_participant';
export const CONSENT_LANGUAGES = ['en', 'hi'] as const;
export const CONSENT_DECISIONS = ['allow', 'decline'] as const;
export function consentCookiePath(tenantId: string, sessionId: string): string {
  return `/api/tenants/${tenantId}/consent-sandbox/sessions/${sessionId}`;
}
