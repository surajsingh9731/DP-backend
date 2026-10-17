import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  completeChoices,
  normalizePurposes,
  consentHash,
} from '../../src/consent-sandbox/consent.policy.js';
const purposes = [
  { id: '10000000-0000-4000-8000-000000000001', labelEn: ' Updates ', labelHi: ' समाचार ' },
];
test('consent purpose catalog trims labels and rejects normalized duplicate IDs and labels', () => {
  assert.equal(normalizePurposes(purposes)[0]?.labelEn, 'Updates');
  for (const row of [
    { ...purposes[0]!, id: purposes[0]!.id },
    { ...purposes[0]!, id: 'another', labelEn: 'UPDATES' },
  ])
    assert.throws(() => normalizePurposes([...purposes, row]));
});
test('every purpose needs one explicit allow or decline with no missing, duplicate or unknown IDs', () => {
  for (const choices of [
    [],
    [{ purposeId: 'unknown', decision: 'allow' as const }],
    [
      { purposeId: purposes[0]!.id, decision: 'allow' as const },
      { purposeId: purposes[0]!.id, decision: 'decline' as const },
    ],
  ])
    assert.throws(() => completeChoices(purposes, choices));
  assert.deepEqual(
    completeChoices(purposes, [{ purposeId: purposes[0]!.id, decision: 'decline' }]),
    [{ purposeId: purposes[0]!.id, decision: 'decline' }],
  );
});
test('receipt content hashes change with decisions and notice versions', () => {
  assert.notEqual(
    consentHash({ notice: 1, decision: 'allow' }),
    consentHash({ notice: 1, decision: 'decline' }),
  );
  assert.notEqual(consentHash({ notice: 1 }), consentHash({ notice: 2 }));
});
