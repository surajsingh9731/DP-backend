export const FOLLOWUP_LIMITS = {
  list: 100,
  history: 100,
  note: 1000,
  evidenceRefs: 8,
  reference: 96,
} as const;
export const FOLLOWUP_ACTIONS = [
  'assign',
  'record_request',
  'declare_complete',
  'verify',
  'block',
  'retain',
  'retry',
  'reopen',
] as const;
export const FOLLOWUP_REFERENCE_PATTERN = /^sample-evidence:[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
