// Local authentication policy; runtime secrets remain in config.ts.
export const AUTH_LIMITS = {
  emailMaxLength: 160,
  codeDigits: 6,
  codeUpperBound: 1_000_000,
  requestsPerWindow: 3,
  requestWindowSeconds: 60,
  challengeLifetimeSeconds: 300,
  verificationAttempts: 5,
  sessionTokenBytes: 32,
  sessionLifetimeSeconds: 1800,
} as const;
export const CODE_PATTERN = /^\d{6}$/;
export const SESSION_COOKIE = 'sahmati_session';
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: false,
  path: '/api',
  maxAge: AUTH_LIMITS.sessionLifetimeSeconds * 1000,
} as const;
export const SESSION_COOKIE_CLEAR_OPTIONS = {
  path: SESSION_COOKIE_OPTIONS.path,
  sameSite: SESSION_COOKIE_OPTIONS.sameSite,
} as const;
