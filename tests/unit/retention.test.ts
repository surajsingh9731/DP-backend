import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RetentionInputs, RetentionPolicy, RetentionHold } from '@sahmati/contracts';
import {
  retentionCandidates,
  retentionInstant,
} from '../../src/retention/retention-preview.policy.js';
const policy: RetentionPolicy = {
  id: 'policy',
  entryId: 'entry',
  entryVersion: 1,
  version: 1,
  name: 'Synthetic policy',
  durationDays: 1,
  rationale: 'Unreviewed invented rationale',
  status: 'internally_reviewed',
  updatedAt: '2026-01-01T00:00:00Z',
  mode: 'local-sample',
  legalReview: 'unreviewed',
};
const inputs: RetentionInputs = {
  entry: {
    id: 'entry',
    version: 1,
    locations: [
      {
        key: 'store',
        kind: 'primary',
        name: 'Synthetic store',
        detail: 'Synthetic',
        mapping: 'declared',
      },
      { key: 'other', kind: 'unmapped', name: 'other', detail: 'Unknown', mapping: 'unknown' },
    ],
  },
  policies: [policy],
  holds: [],
  receipts: [],
  rights: [],
  followups: [],
};
test('retention instants require explicit timezone and canonicalize equivalent offsets without local-time assumptions', () => {
  assert.equal(retentionInstant('2026-01-01T05:30:00+05:30'), '2026-01-01T00:00:00.000Z');
  for (const value of [
    '2026-01-01',
    '2026-01-01T00:00:00',
    '2026-02-30T00:00:00Z',
    '0000-01-01T00:00:00Z',
  ])
    assert.throws(() => retentionInstant(value));
});
test('unanchored synthetic locations stay unknown even with an internally reviewed draft period', () => {
  const rows = retentionCandidates(inputs, '2026-01-02T00:00:00Z');
  assert.ok(rows.length);
  assert.ok(
    rows.every(
      (row) => row.outcome === 'unknown' && row.reasons.includes('missing_reference_time'),
    ),
  );
});
test('active holds take precedence over missing references and conflicting policy drafts; released holds do not', () => {
  const hold: RetentionHold = {
    id: 'hold',
    entryId: 'entry',
    version: 1,
    scope: 'activity',
    target: null,
    reason: 'Invented local hold',
    status: 'active',
    updatedAt: policy.updatedAt,
    mode: 'local-sample',
  };
  const current = {
    ...inputs,
    policies: [policy, { ...policy, id: 'other', durationDays: 2 }],
    holds: [hold],
  };
  const rows = retentionCandidates(current, '2026-01-02T00:00:00Z');
  assert.ok(rows.every((row) => row.outcome === 'held' && row.reasons.includes('policy_conflict')));
  assert.ok(
    retentionCandidates(
      { ...current, holds: [{ ...hold, status: 'released' }] },
      '2026-01-02T00:00:00Z',
    ).every((row) => row.outcome === 'conflict'),
  );
});
