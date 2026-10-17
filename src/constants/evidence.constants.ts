export const EVIDENCE_KINDS = [
  'notice',
  'notice_decision',
  'consent',
  'withdrawal',
  'followup',
  'check_review',
  'check_evaluation',
  'rights',
] as const;
export const EVIDENCE_PROVENANCE = ['recorded', 'manual', 'computed'] as const;
export const EVIDENCE_LIMITS = { page: 20, maxPage: 50, search: 80, cursor: 1600 } as const;
