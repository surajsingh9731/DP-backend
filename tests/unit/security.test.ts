import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeHash, equalHash, hashToken, mayClose } from '../../src/api/security.js';
import { allowedRecipient } from '../../src/worker/channel.js';
import { eventDigest } from '../../src/api/workspace.js';
import type { TenantScope } from '@sahmati/contracts';
const scope: TenantScope = {
  tenantId: 'tenant',
  userId: 'actor',
  branchId: 'branch',
  role: 'staff',
};
test('code digests bind the challenge, code and pepper without storing a usable code', () => {
  const a = codeHash('one', '123456', 'pepper');
  assert.equal(a.length, 64);
  assert.notEqual(a, codeHash('two', '123456', 'pepper'));
  assert.notEqual(a, codeHash('one', '123456', 'other'));
  assert.ok(equalHash(a, a));
  assert.equal(equalHash(a, 'short'), false);
  assert.equal(equalHash(a, codeHash('one', '654321', 'pepper')), false);
  assert.notEqual(hashToken('token'), 'token');
});
test('review authority is assigned staff or owner; viewers cannot mutate', () => {
  assert.ok(mayClose(scope, 'actor'));
  assert.equal(mayClose(scope, 'someone-else'), false);
  assert.ok(mayClose({ ...scope, role: 'owner' }, 'someone-else'));
  assert.equal(mayClose({ ...scope, role: 'viewer' }, 'actor'), false);
});
test('local channel has an exact synthetic allowlist', () => {
  assert.ok(allowedRecipient('staff@demo.sahmati.test'));
  for (const value of [
    'person@example.com',
    'staff@demo.sahmati.test.evil',
    'staff+extra@demo.sahmati.test',
    'STAFF@demo.sahmati.test',
    'staff@demo.sahmati.test\n',
  ])
    assert.equal(allowedRecipient(value), false, value);
});
test('evidence digest changes when action or chain link changes', () => {
  const base = { id: '1', action: 'task.created', previousHash: 'genesis', sequence: 1 };
  assert.equal(eventDigest(base), eventDigest(base));
  assert.notEqual(eventDigest(base), eventDigest({ ...base, action: 'task.closed' }));
  assert.notEqual(eventDigest(base), eventDigest({ ...base, previousHash: 'changed' }));
});
