import { createHash } from 'node:crypto';
import { SECURITY_HASH_ALGORITHM } from '../constants/security.constants.js';
export function eventDigest(event: Record<string, string | number>): string {
  return createHash(SECURITY_HASH_ALGORITHM).update(JSON.stringify(event)).digest('hex');
}
