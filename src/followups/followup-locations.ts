import { createHash } from 'node:crypto';
import type { FollowupLocation, RegisterData } from '@sahmati/contracts';
import { SECURITY_HASH_ALGORITHM } from '../constants/security.constants.js';
export function followupDigest(value: unknown): string {
  return createHash(SECURITY_HASH_ALGORITHM)
    .update(
      JSON.stringify(value, (_key, data: unknown) =>
        data && typeof data === 'object' && !Array.isArray(data)
          ? Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)))
          : data,
      ),
    )
    .digest('hex');
}
const normalized = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
/** Candidates from the immutable notice snapshot, never a claim of complete inventory or legal erasure scope. */
export function followupLocations(data: RegisterData): FollowupLocation[] {
  const rows: Omit<FollowupLocation, 'key'>[] = [];
  for (const ref of data.storageReferences ?? [])
    rows.push({ kind: ref.medium, name: ref.name, detail: ref.location, mapping: 'declared' });
  if (
    data.storageLocation.trim() &&
    !rows.some((row) => normalized(row.detail) === normalized(data.storageLocation))
  )
    rows.push({
      kind: 'primary',
      name: data.name,
      detail: data.storageLocation,
      mapping: 'declared',
    });
  for (const ref of data.vendorReferences ?? [])
    rows.push({ kind: 'vendor', name: ref.name, detail: ref.service, mapping: 'declared' });
  if (data.hasPaperRecords && !(data.storageReferences ?? []).some((ref) => ref.medium === 'paper'))
    rows.push({ kind: 'unmapped', name: 'paper', detail: 'paper-unmapped', mapping: 'unknown' });
  rows.push({
    kind: 'unmapped',
    name: 'other',
    detail: 'other-locations-and-backups-unmapped',
    mapping: 'unknown',
  });
  const unique = new Map<string, FollowupLocation>();
  for (const row of rows) {
    const key = followupDigest({
      kind: row.kind,
      name: normalized(row.name),
      detail: normalized(row.detail),
    });
    if (!unique.has(key)) unique.set(key, { key, ...row });
  }
  return [...unique.values()];
}

export function mappedFollowupLocations(
  data: RegisterData,
  tasks: import('@sahmati/contracts').FollowupTask[],
): FollowupLocation[] {
  const locations = followupLocations(data);
  for (const task of tasks) {
    const original = task.mappingResolution?.originalLocation;
    if (original?.name === 'paper') {
      const index = locations.findIndex((location) => location.key === original.key);
      if (index >= 0) locations[index] = task.location;
    }
    if (
      task.location.mapping === 'declared' &&
      !locations.some((location) => location.key === task.location.key)
    )
      locations.push(task.location);
  }
  return locations;
}
