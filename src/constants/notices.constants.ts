export const NOTICE_LIMITS = { comment: 1000, version: 1000000, list: 50 } as const;
export const NOTICE_LANGUAGES = ['en', 'hi'];
export const NOTICE_DECISIONS = ['request_changes', 'publish_sample'];
export const NOTICE_STATUS = {
  inReview: 'in_review',
  changesRequested: 'changes_requested',
  samplePublished: 'sample_published',
} as const;
export const NOTICE_MODE = 'local-sample';
export const NOTICE_LEGAL_REVIEW_STATUS = 'unreviewed';
export const NOTICE_SUBMIT_ROLES = ['owner', 'staff'];
export const NOTICE_REVIEW_ROLE = 'owner';
