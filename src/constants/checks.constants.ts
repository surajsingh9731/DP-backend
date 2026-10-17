export const CHECK_LIMITS = {
  history: 20,
  events: 1000,
  minutes: 1440,
  label: 160,
  rationale: 1000,
} as const;
export const CHECK_RESULTS = ['pass', 'fail', 'unknown', 'not_applicable'] as const;
export const MAPPING_KINDS = ['primary', 'digital', 'paper', 'vendor'] as const;
