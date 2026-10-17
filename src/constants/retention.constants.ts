export const RETENTION_LIMITS = {
  name: 120,
  rationale: 1200,
  maxDays: 36500,
  page: 20,
  maxPage: 50,
  policies: 100,
  holds: 100,
  records: 100,
  related: 1000,
  history: 100,
} as const;
export const RETENTION_DAY_MS = 86400000;
export const RETENTION_OUTCOMES = [
  'held',
  'conflict',
  'unknown',
  'not_due',
  'candidate_review',
] as const;
export const RETENTION_HOLD_SCOPES = ['activity', 'sample_record', 'location'] as const;
