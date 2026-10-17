import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { SECURITY_HASH_ALGORITHM } from '../constants/security.constants.js';
export const hashToken = (token: string): string =>
  createHash(SECURITY_HASH_ALGORITHM).update(token).digest('hex');
export const codeHash = (id: string, code: string, pepper: string): string =>
  createHmac(SECURITY_HASH_ALGORITHM, pepper).update(`${id}:${code}`).digest('hex');
export function equalHash(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
