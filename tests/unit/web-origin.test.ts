import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedWebOrigin } from '../../src/bootstrap/web-origin.policy.js';
const canonical = 'http://127.0.0.1:4200';
test('local web origin accepts only the configured origin and its exact localhost alias', () => {
  for (const origin of [undefined, canonical, 'http://localhost:4200'])
    assert.equal(allowedWebOrigin(origin, canonical, 'local'), true);
  for (const origin of [
    'null',
    'http://localhost:4201',
    'https://localhost:4200',
    'http://localhost.evil:4200',
    'http://127.0.0.2:4200',
    'http://localhost:4200.evil',
    'https://untrusted.example',
  ])
    assert.equal(allowedWebOrigin(origin, canonical, 'local'), false);
});
test('loopback alias is never inferred for a nonlocal mode or nonloopback configured origin', () => {
  assert.equal(allowedWebOrigin('http://localhost:4200', canonical, 'production'), false);
  assert.equal(
    allowedWebOrigin('http://localhost:4200', 'http://example.test:4200', 'local'),
    false,
  );
});
