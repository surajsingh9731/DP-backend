export const PREPARATION_LIMITS = {
  title: 120,
  body: 4000,
  contactName: 120,
  email: 200,
  comment: 1000,
  version: 999999,
  list: 100,
  history: 100,
} as const;
export const PREPARATION_LANGUAGES = ['en', 'hi'] as const;
export const PREPARATION_SOURCES = ['custom-draft', 'education-sample'] as const;
export const PREPARATION_ACTIONS = ['submit', 'request_changes', 'review_internal'] as const;
export const PREPARATION_STATUS = {
  draft: 'draft',
  inReview: 'in_review',
  changesRequested: 'changes_requested',
  reviewed: 'internally_reviewed',
} as const;
