export const TASK_TEMPLATES = ['review_inventory'];
export const TASK_STATUS = { open: 'open', closed: 'closed' } as const;
export const TASK_VERSION_LIMITS = { minimum: 1, maximum: 1_000_000 } as const;
export const EVIDENCE_ACTIONS = { created: 'task.created', closed: 'task.closed' } as const;
export const EVIDENCE_GENESIS = 'genesis';
export const WORKSPACE_SUMMARY_LIMIT = 50;
