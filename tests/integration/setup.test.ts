import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../../src/api/app.js';
import { loadConfig } from '../../src/api/config.js';
import { Database } from '../../src/api/database.js';
import { hashToken } from '../../src/api/security.js';
import type { SetupResponse, SetupView, RegisterView, NoticePreview } from '@sahmati/contracts';
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222';
const owner = '00000000-0000-4000-8000-000000000001',
  branch = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const admin = new Pool({ connectionString: loadConfig().adminUrl });
let app: Awaited<ReturnType<typeof createApp>>, base: string, db: Database;
const cookies: Record<string, string> = {};
const hashes: string[] = [];
let setup: SetupView;
let draft: NonNullable<SetupView['draft']>;
const input = (extra: Record<string, unknown> = {}) => ({
  version: setup?.version ?? 0,
  organisationName: 'Synthetic education lab',
  packId: 'education',
  packVersion: 1,
  step: 1,
  draft: null,
  ...extra,
});
async function request(method = 'GET', body?: unknown, role = 'owner', suffix = '', tenant = A) {
  return fetch(`${base}/tenants/${tenant}/setup${suffix}`, {
    method,
    headers: { cookie: cookies[role]!, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}
before(async () => {
  app = await createApp(true);
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api`;
  db = app.get(Database);
  for (const [role, n] of [
    ['owner', '1'],
    ['staff', '2'],
    ['viewer', '3'],
    ['other', '4'],
    ['operator', '5'],
  ]) {
    const token = randomBytes(32).toString('hex');
    const hash = hashToken(token);
    hashes.push(hash);
    await admin.query(
      "INSERT INTO identity.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '10 minutes')",
      [hash, `00000000-0000-4000-8000-00000000000${n}`],
    );
    cookies[role!] = `sahmati_session=${token}`;
  }
});
after(async () => {
  await app?.close();
  await admin.query('DELETE FROM identity.sessions WHERE token_hash=ANY($1::text[])', [hashes]);
  await admin.end();
});
test('setup registry exposes one versioned sample and seven planned unreviewed packs', async () => {
  const result = (await (await request()).json()) as SetupResponse;
  assert.equal(result.setup, null);
  assert.equal(result.packs.length, 8);
  assert.deepEqual(
    result.packs.filter((p) => p.available).map((p) => p.id),
    ['education'],
  );
  assert.equal(result.packs.filter((p) => p.status === 'planned-unreviewed').length, 7);
  draft = result.packs[0]!.defaults!;
  assert.ok(draft.purposeHi);
  assert.equal((await request('PUT', input(), 'staff')).status, 403);
  assert.equal((await request('PUT', input(), 'viewer')).status, 403);
});
test('setup rejects malformed, incomplete, unpublished legal and pack-version inputs', async () => {
  for (const body of [
    input({ draft: [] }),
    input({ draft: 'text' }),
    input({ draft: undefined }),
    input({ step: 2 }),
    input({ step: 4 }),
    input({ packId: 'health' }),
    input({ packVersion: 2 }),
    input({ published: true }),
    input({ tenantId: B }),
    input({ organisationName: 'x'.repeat(121) }),
    input({ step: 2, draft: { ...draft, purposeHi: '' } }),
  ])
    assert.equal((await request('PUT', body)).status, 400);
  const result = await request('PUT', input());
  assert.equal(result.status, 200);
  setup = (await result.json()) as SetupView;
  assert.equal(setup.version, 1);
  assert.equal(
    (await request('POST', { version: 1, idempotencyKey: randomUUID() }, 'owner', '/complete'))
      .status,
    409,
  );
});
test('setup resumes saved draft and staff prepares activity without changing organisation or pack', async () => {
  const saved = (await (await request()).json()) as SetupResponse;
  assert.equal(saved.setup?.version, 1);
  assert.equal((await request('PUT', input({ organisationName: 'Changed' }), 'staff')).status, 403);
  assert.equal((await request('PUT', input({ packVersion: 2 }))).status, 400);
  const result = await request('PUT', input({ step: 2, draft }), 'staff');
  assert.equal(result.status, 200);
  setup = (await result.json()) as SetupView;
  assert.deepEqual(setup.draft, draft);
  assert.equal((await request('PUT', input({ version: 1, step: 2, draft }))).status, 409);
  assert.equal((await request('GET', undefined, 'viewer')).status, 200);
});
test('setup enforces tenant, branch, platform and immediate membership-revocation boundaries', async () => {
  assert.equal((await request('GET', undefined, 'other')).status, 403);
  assert.equal((await request('GET', undefined, 'operator')).status, 403);
  assert.equal(
    ((await (await request('GET', undefined, 'other', '', B)).json()) as SetupResponse).setup,
    null,
  );
  const second = randomUUID();
  await admin.query('INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3)', [
    A,
    second,
    'Setup isolated branch',
  ]);
  await admin.query(
    'UPDATE identity.memberships SET branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
    [second, A, owner],
  );
  try {
    assert.equal(((await (await request()).json()) as SetupResponse).setup, null);
  } finally {
    await admin.query(
      'UPDATE identity.memberships SET branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
      [branch, A, owner],
    );
  }
  await admin.query(
    'UPDATE identity.memberships SET active=false WHERE tenant_id=$1 AND user_id=$2',
    [A, owner],
  );
  try {
    assert.equal((await request()).status, 403);
    assert.equal((await request('PUT', input({ step: 3, draft }))).status, 403);
  } finally {
    await admin.query(
      'UPDATE identity.memberships SET active=true WHERE tenant_id=$1 AND user_id=$2',
      [A, owner],
    );
  }
  assert.equal((await db.query('SELECT * FROM workspace.setup_drafts')).rowCount, 0);
  await assert.rejects(
    db.transaction(B, (c) =>
      c.query(
        'INSERT INTO workspace.setup_drafts(tenant_id,branch_id,version,organisation_name,pack_id,pack_version,step) VALUES($1,$2,1,$3,$4,1,1)',
        [A, second, 'Forbidden', 'education'],
      ),
    ),
    /row-level security/,
  );
});
test('concurrent saves accept one version and completion rollback preserves draft and register counts', async () => {
  const results = await Promise.all([
    request('PUT', input({ step: 3, draft })),
    request('PUT', input({ step: 3, draft })),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  setup = (await results.find((r) => r.status === 200)!.json()) as SetupView;
  assert.equal(
    (
      await request(
        'POST',
        { version: setup.version, idempotencyKey: randomUUID() },
        'staff',
        '/complete',
      )
    ).status,
    403,
  );
  const count = (await admin.query('SELECT count(*) FROM workspace.register_entries')).rows[0]
    .count;
  await admin.query(
    "CREATE FUNCTION workspace.setup_fail_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'setup revision failure'; END $$; CREATE TRIGGER setup_revision_failure BEFORE INSERT ON workspace.register_revisions FOR EACH ROW EXECUTE FUNCTION workspace.setup_fail_revision()",
  );
  try {
    assert.equal(
      (
        await request(
          'POST',
          { version: setup.version, idempotencyKey: randomUUID() },
          'owner',
          '/complete',
        )
      ).status,
      500,
    );
    assert.equal(
      (await admin.query('SELECT count(*) FROM workspace.register_entries')).rows[0].count,
      count,
    );
    assert.equal(((await (await request()).json()) as SetupResponse).setup?.status, 'draft');
  } finally {
    await admin.query(
      'DROP TRIGGER setup_revision_failure ON workspace.register_revisions; DROP FUNCTION workspace.setup_fail_revision()',
    );
  }
});
test('racing completions deduplicate one register with immutable pinned pack provenance', async () => {
  const key = randomUUID();
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      request('POST', { version: setup.version, idempotencyKey: key }, 'owner', '/complete'),
    ),
  );
  assert.ok(results.every((r) => r.status === 201));
  const completed = await Promise.all(results.map((r) => r.json() as Promise<SetupView>));
  assert.equal(new Set(completed.map((r) => r.registerEntryId)).size, 1);
  setup = completed[0]!;
  assert.equal(setup.status, 'completed');
  assert.equal(
    (await request('POST', { version: 1, idempotencyKey: key }, 'owner', '/complete')).status,
    201,
  );
  assert.equal(
    (
      await request(
        'POST',
        { version: setup.version, idempotencyKey: randomUUID() },
        'owner',
        '/complete',
      )
    ).status,
    409,
  );
  assert.equal((await request('PUT', input({ step: 3, draft }))).status, 409);
  const id = setup.registerEntryId!;
  const provenance = { id: 'education', version: 1, reviewStatus: 'unreviewed' };
  const entries = (await fetch(`${base}/tenants/${A}/register`, {
    headers: { cookie: cookies['owner']! },
  }).then((r) => r.json())) as RegisterView[];
  assert.deepEqual(entries.find((e) => e.id === id)?.sourcePack, provenance);
  const updated = await fetch(`${base}/tenants/${A}/register/${id}`, {
    method: 'PATCH',
    headers: { cookie: cookies['owner']!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...draft, name: 'Edited sample', version: 1 }),
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(((await updated.json()) as RegisterView).sourcePack, provenance);
  const preview = (await fetch(`${base}/tenants/${A}/register/${id}/notice-preview`, {
    headers: { cookie: cookies['owner']! },
  }).then((r) => r.json())) as NoticePreview;
  assert.deepEqual(preview.sourcePack, provenance);
  assert.equal(preview.status, 'unreviewed-draft');
  await assert.rejects(
    db.transaction(A, (c) =>
      c.query('UPDATE workspace.register_pack_sources SET pack_version=2 WHERE entry_id=$1', [id]),
    ),
    /permission denied/,
  );
});
