import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FollowupTask, TenantScope } from '@sahmati/contracts';
import { followupLocations, followupDigest } from '../../src/followups/followup-locations.js';
import { applyFollowupAction } from '../../src/followups/followup.policy.js';
const scope: TenantScope = {
  tenantId: 'tenant',
  branchId: 'branch',
  userId: 'owner',
  role: 'owner',
};
const task: FollowupTask = {
  id: 'task',
  receiptId: 'receipt',
  receiptHash: 'hash',
  sessionId: 'session',
  noticeId: 'notice',
  entryVersion: 1,
  withdrawnPurposeIds: ['purpose'],
  location: {
    key: 'key',
    kind: 'digital',
    name: 'Synthetic store',
    detail: 'Sample location',
    mapping: 'declared',
  },
  status: 'pending',
  version: 1,
  responsibleRole: 'owner',
  assignee: null,
  declaredBy: null,
  declaredEvidence: [],
  retentionNote: 'Unreviewed',
  updatedAt: '2026-10-17T00:00:00Z',
  mode: 'local-sample',
  applicability: 'unreviewed-candidate',
};
const dto = {
  version: 1,
  action: 'declare_complete' as const,
  note: 'Synthetic only',
  evidenceRefs: ['sample-evidence:claim'],
  syntheticOnlyAcknowledged: true as const,
  idempotencyKey: 'key',
};
test('location candidates deduplicate exact declared stores and retain explicit paper and other unknowns', () => {
  const rows = followupLocations({
    name: 'Sample',
    purposeEn: 'Sample',
    purposeHi: 'नमूना',
    dataCategories: ['Sample'],
    storageLocation: ' Synthetic store ',
    retentionNote: 'Unreviewed',
    contact: 'Synthetic',
    hasPaperRecords: true,
    storageReferences: [
      { name: 'Local', medium: 'digital', location: 'Synthetic store' },
      { name: 'Local', medium: 'digital', location: 'SYNTHETIC STORE' },
    ],
    vendorReferences: [{ name: 'Vendor', service: 'Sample' }],
  });
  assert.deepEqual(
    rows.map((row) => row.kind),
    ['digital', 'vendor', 'unmapped', 'unmapped'],
  );
  assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
});
test('declared completion changes a copy and cannot be self-verified or silently promoted', () => {
  const next = applyFollowupAction(task, dto, scope);
  assert.equal(next.status, 'completion_declared');
  assert.equal(task.status, 'pending');
  assert.throws(() => applyFollowupAction(next, { ...dto, version: 2, action: 'verify' }, scope));
  assert.throws(() => applyFollowupAction(task, { ...dto, action: 'verify' }, scope));
});
test('independent manual review requires another owner and a separate evidence reference', () => {
  const declared = applyFollowupAction(task, dto, scope),
    other = { ...scope, userId: 'different-owner' };
  assert.throws(() =>
    applyFollowupAction(declared, { ...dto, version: 2, action: 'verify' }, other),
  );
  const reviewed = applyFollowupAction(
    declared,
    { ...dto, version: 2, action: 'verify', evidenceRefs: ['sample-evidence:review'] },
    other,
  );
  assert.equal(reviewed.status, 'independently_reviewed');
  assert.equal(reviewed.applicability, 'unreviewed-candidate');
});
test('unmapped locations cannot become requested, declared complete, independently reviewed or retained', () => {
  const unknown = {
    ...task,
    status: 'unknown' as const,
    location: { ...task.location, kind: 'unmapped' as const, mapping: 'unknown' as const },
  };
  for (const action of ['record_request', 'declare_complete', 'verify', 'retain'] as const)
    assert.throws(() => applyFollowupAction(unknown, { ...dto, action }, scope));
  const blocked = applyFollowupAction(unknown, { ...dto, action: 'block' }, scope);
  assert.equal(
    applyFollowupAction(blocked, { ...dto, version: 2, action: 'retry' }, scope).status,
    'unknown',
  );
});
test('versions, read-only roles, assignment and retention/reopen authority are enforced', () => {
  assert.throws(() => applyFollowupAction(task, { ...dto, version: 99 }, scope));
  for (const role of ['staff', 'viewer'] as const)
    assert.throws(() => applyFollowupAction(task, dto, { ...scope, role }));
  const retained = applyFollowupAction(task, { ...dto, action: 'retain' }, scope);
  assert.equal(retained.status, 'retention_exception_declared');
  const assigned = {
    ...retained,
    assignee: { id: 'staff', displayName: 'Sample staff', role: 'staff' as const },
  };
  assert.throws(() =>
    applyFollowupAction(
      assigned,
      { ...dto, version: 2, action: 'retry' },
      { ...scope, userId: 'staff', role: 'staff' },
    ),
  );
});

test('follow-up hash remains reproducible after JSONB reorders nested keys', () => {
  assert.equal(
    followupDigest({ z: 1, a: { name: 'Sample', state: 'pending' }, list: [1, 2] }),
    followupDigest({ list: [1, 2], a: { state: 'pending', name: 'Sample' }, z: 1 }),
  );
});
