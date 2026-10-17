import { BadRequestException } from '@nestjs/common';
import type { RetentionSnapshot, RetentionPreviewPage } from '@sahmati/contracts';
import { followupDigest } from '../followups/followup-locations.js';
import { RETENTION_OUTCOMES } from '../constants/retention.constants.js';
export function retentionPreviewPage(
  snapshot: RetentionSnapshot,
  freshness: RetentionPreviewPage['freshness'],
  limit: number,
  cursor?: string,
): RetentionPreviewPage {
  let offset = 0;
  if (cursor) {
    try {
      if (!/^[A-Za-z0-9_-]{1,600}$/.test(cursor)) throw Error();
      const c: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (!c || typeof c !== 'object') throw Error();
      const page = c as Record<string, unknown>;
      if (
        Object.keys(page).sort().join(',') !== 'hash,id,limit,offset' ||
        page.id !== snapshot.id ||
        page.hash !== snapshot.contentHash ||
        page.limit !== limit ||
        typeof page.offset !== 'number' ||
        !Number.isSafeInteger(page.offset) ||
        page.offset < 0 ||
        page.offset > snapshot.candidates.length
      )
        throw Error();
      offset = page.offset;
    } catch {
      throw new BadRequestException('Snapshot page cursor is invalid. Return to the first page.');
    }
  }
  const { contentHash, ...content } = snapshot,
    items = snapshot.candidates.slice(offset, offset + limit),
    nextOffset = offset + items.length;
  return {
    id: snapshot.id,
    entryId: snapshot.entryId,
    asOf: snapshot.asOf,
    createdAt: snapshot.createdAt,
    inputHash: snapshot.inputHash,
    contentHash,
    integrity: followupDigest(content) === contentHash ? 'match' : 'mismatch',
    freshness,
    checkedAt: new Date().toISOString(),
    items,
    nextCursor:
      nextOffset < snapshot.candidates.length
        ? Buffer.from(
            JSON.stringify({ id: snapshot.id, hash: contentHash, limit, offset: nextOffset }),
          ).toString('base64url')
        : null,
    candidateCount: snapshot.candidates.length,
    summary: Object.fromEntries(
      RETENTION_OUTCOMES.map((outcome) => [
        outcome,
        snapshot.candidates.filter((item) => item.outcome === outcome).length,
      ]),
    ) as RetentionPreviewPage['summary'],
    sourceVersions: {
      entry: snapshot.inputs.entry.version,
      policies: snapshot.inputs.policies.map(({ id, version, status }) => ({
        id,
        version,
        status,
      })),
      holds: snapshot.inputs.holds.map(({ id, version, status }) => ({ id, version, status })),
    },
    execution: 'not-available',
  };
}
