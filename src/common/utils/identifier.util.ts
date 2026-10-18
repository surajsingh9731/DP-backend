/** Shared email/phone identifier helpers — used by auth, participant verification, and staff invite, which all accept "email or E.164 phone" as one field. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function isEmailIdentifier(identifier: string): boolean {
  return EMAIL_RE.test(identifier);
}

export function maskIdentifier(identifier: string): string {
  if (isEmailIdentifier(identifier)) {
    const [local, domain] = identifier.split("@");
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `${identifier.slice(0, 3)}${"*".repeat(Math.max(identifier.length - 5, 0))}${identifier.slice(-2)}`;
}
