export const RIGHTS_LIMITS = {
  list: 50,
  history: 100,
  details: 1200,
  correction: 160,
  note: 1000,
  response: 2000,
} as const;
export const RIGHTS_KINDS = ['access', 'correction', 'erasure', 'grievance'] as const;
export const RIGHTS_ACTIONS = [
  'assign',
  'begin_review',
  'declare_item',
  'verify_item',
  'block_item',
  'retain_item',
  'retry_item',
  'respond',
  'close',
  'reopen',
] as const;
