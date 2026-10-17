export const MESSAGE_CHANNEL = Symbol('MessageChannel');
export const SYNTHETIC_RECIPIENTS = ['owner', 'staff', 'viewer', 'other', 'operator'].map(
  (account) => `${account}@demo.sahmati.test`,
);
export const DELIVERY_POLICY = {
  maximumAttempts: 3,
  leaseSeconds: 10,
  retryBaseSeconds: 1,
} as const;
// Fixed internal identifiers only: never accept a caller-supplied SQL table name.
export const DELIVERY_TABLES = { task: 'workspace.outbox', login: 'delivery.login_jobs' } as const;
