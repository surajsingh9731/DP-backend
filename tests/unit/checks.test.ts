import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FollowupTask, TaskEvidenceReview } from '@sahmati/contracts';
import {
  reviewFreshness,
  assertCheckVersions,
  assertReviewDecision,
} from '../../src/checks/checks.policy.js';
const task = { version: 2, location: { mapping: 'declared' } } as FollowupTask;
const review = {
  version: 1,
  taskVersion: 2,
  validUntil: '2026-10-17T10:00:00Z',
} as TaskEvidenceReview;
test('review freshness distinguishes missing, expired and changed task versions', () => {
  const now = new Date('2026-10-17T09:00:00Z');
  assert.equal(reviewFreshness(task, undefined, now), 'missing');
  assert.equal(reviewFreshness(task, review, now), 'current');
  assert.equal(reviewFreshness(task, review, new Date('2026-10-17T10:00:00Z')), 'expired');
  assert.equal(reviewFreshness({ ...task, version: 3 }, review, now), 'task_changed');
});
test('both task and review versions protect decisions and repeated evaluations', () => {
  assert.doesNotThrow(() => assertCheckVersions(task, review, 2, 1));
  assert.throws(() => assertCheckVersions(task, review, 1, 1));
  assert.throws(() => assertCheckVersions(task, review, 2, 0));
});
test('not applicable is an explicit paired owner decision rather than an inferred success', () => {
  assert.throws(() =>
    assertReviewDecision(task, { applicability: 'applicable', result: 'not_applicable' }),
  );
  assert.throws(() =>
    assertReviewDecision(task, { applicability: 'not_applicable', result: 'pass' }),
  );
  assert.doesNotThrow(() =>
    assertReviewDecision(task, { applicability: 'not_applicable', result: 'not_applicable' }),
  );
});
test('unknown coverage cannot be passed or dismissed using applicability overrides', () => {
  const unknown = { ...task, location: { ...task.location, mapping: 'unknown' as const } };
  for (const dto of [
    { applicability: 'not_applicable', result: 'not_applicable' },
    { applicability: 'applicable', result: 'pass' },
    { applicability: 'applicable', result: 'fail' },
  ] as const)
    assert.throws(() => assertReviewDecision(unknown, dto));
  assert.doesNotThrow(() =>
    assertReviewDecision(unknown, { applicability: 'applicable', result: 'unknown' }),
  );
});
