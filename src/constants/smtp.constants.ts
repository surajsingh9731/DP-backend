export const SMTP_POLICY = {
  connectionTimeoutMs: 10_000,
  greetingTimeoutMs: 10_000,
  socketTimeoutMs: 20_000,
  minimumPort: 1,
  maximumPort: 65_535,
  messageIdDomain: 'mail.sahmati.invalid',
} as const;
export const SMTP_ADDRESS_PATTERN = /^[^\s@<>,;\r\n]+@[^\s@<>,;\r\n]+\.[^\s@<>,;\r\n]+$/;
export const SMTP_MESSAGE_ID_PATTERN = /^[a-f0-9-]{36}$/i;
