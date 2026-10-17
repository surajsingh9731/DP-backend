import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { TenantScope } from '@sahmati/contracts';
import type { EvidenceListQuery, EvidenceWindow } from '../evidence-read/evidence-source.js';
import { EVIDENCE_LIMITS } from '../constants/evidence.constants.js';
export function evidenceBinding(scope: TenantScope, query: EvidenceListQuery): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        scope.tenantId,
        scope.branchId,
        scope.userId,
        scope.role,
        query.kind ?? '',
        query.provenance ?? '',
        query.q ?? '',
        query.limit,
      ]),
    )
    .digest('hex');
}
export function evidenceWindow(scope: TenantScope, query: EvidenceListQuery): EvidenceWindow {
  if (!query.cursor) return { asOf: new Date().toISOString(), beforeAt: null, beforeKey: null };
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(query.cursor) || query.cursor.length > EVIDENCE_LIMITS.cursor)
      throw Error();
    const value: unknown = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object') throw Error();
    const c = value as Record<string, unknown>;
    if (
      Object.keys(c).sort().join(',') !== 'asOf,beforeAt,beforeKey,binding' ||
      c.binding !== evidenceBinding(scope, query) ||
      typeof c.asOf !== 'string' ||
      typeof c.beforeAt !== 'string' ||
      typeof c.beforeKey !== 'string' ||
      !/^[-a-z0-9_:]{1,100}$/.test(c.beforeKey) ||
      !Number.isFinite(Date.parse(c.asOf)) ||
      new Date(c.asOf).getUTCFullYear() < 1 ||
      new Date(c.asOf).toISOString() !== c.asOf ||
      !Number.isFinite(Date.parse(c.beforeAt)) ||
      new Date(c.beforeAt).getUTCFullYear() < 1 ||
      new Date(c.beforeAt).toISOString() !== c.beforeAt ||
      Date.parse(c.beforeAt) > Date.parse(c.asOf) ||
      Date.parse(c.asOf) > Date.now() + 1000
    )
      throw Error();
    return { asOf: c.asOf, beforeAt: c.beforeAt, beforeKey: c.beforeKey };
  } catch {
    throw new BadRequestException('Page cursor is invalid or no longer matches this scope/filter.');
  }
}
export function evidenceCursor(
  scope: TenantScope,
  query: EvidenceListQuery,
  window: EvidenceWindow,
  last: { at: string; key: string },
): string {
  return Buffer.from(
    JSON.stringify({
      asOf: window.asOf,
      beforeAt: last.at,
      beforeKey: last.key,
      binding: evidenceBinding(scope, query),
    }),
  ).toString('base64url');
}
