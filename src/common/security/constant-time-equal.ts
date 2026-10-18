import { timingSafeEqual } from "node:crypto";

/**
 * Compares two equal-length hex digests (e.g. an OTP's SHA-256 hash)
 * without leaking timing information about where they first differ.
 * `timingSafeEqual` throws on a length mismatch rather than returning
 * false, so that case is handled explicitly first — a length mismatch
 * between a freshly computed hash and a stored one only ever happens if
 * the stored value is malformed, never from attacker-controlled input,
 * so returning false there leaks nothing useful.
 */
export function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
