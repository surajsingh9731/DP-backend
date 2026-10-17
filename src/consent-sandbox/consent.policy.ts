import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ConsentChoice, ConsentPurpose, TenantScope } from '@sahmati/contracts';
import { SECURITY_HASH_ALGORITHM } from '../constants/security.constants.js';
export function consentHash(value: unknown): string {
  return createHash(SECURITY_HASH_ALGORITHM).update(JSON.stringify(value)).digest('hex');
}
export function assertConsentEditor(scope: TenantScope): void {
  if (scope.role === 'viewer')
    throw new ForbiddenException('Read-only role cannot operate synthetic participants.');
}
export function normalizePurposes(purposes: ConsentPurpose[]): ConsentPurpose[] {
  const rows = purposes.map((p) => ({
    id: p.id.toLowerCase(),
    labelEn: p.labelEn.trim(),
    labelHi: p.labelHi.trim(),
  }));
  for (const field of ['id', 'labelEn', 'labelHi'] as const)
    if (new Set(rows.map((p) => p[field].normalize('NFKC').toLowerCase())).size !== rows.length)
      throw new BadRequestException('Duplicate purpose identifiers or labels.');
  return rows;
}
export function completeChoices(
  purposes: ConsentPurpose[],
  choices: ConsentChoice[],
): ConsentChoice[] {
  const byId = new Map(choices.map((c) => [c.purposeId.toLowerCase(), c.decision]));
  if (
    choices.length !== purposes.length ||
    byId.size !== choices.length ||
    purposes.some((p) => !byId.has(p.id))
  )
    throw new BadRequestException('Choose allow or decline once for every purpose.');
  return purposes.map((p) => ({ purposeId: p.id, decision: byId.get(p.id)! }));
}
