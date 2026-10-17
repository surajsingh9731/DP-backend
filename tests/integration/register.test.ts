import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../../src/api/app.js';
import { loadConfig } from '../../src/api/config.js';
import { Database } from '../../src/api/database.js';
import { hashToken } from '../../src/api/security.js';
import type {
  NoticePreview,
  RegisterData,
  RegisterRevision,
  RegisterView,
} from '@sahmati/contracts';
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222';
const admin = new Pool({ connectionString: loadConfig().adminUrl });
let app: Awaited<ReturnType<typeof createApp>>, base: string, db: Database, entry: RegisterView;
const cookies: Record<string, string> = {};
const hashes: string[] = [];
const draft: RegisterData = {
  name: 'Synthetic admissions register',
  purposeEn: 'Manage a synthetic application',
  purposeHi: 'काल्पनिक आवेदन का प्रबंधन',
  dataCategories: ['Synthetic application reference'],
  storageLocation: 'Local synthetic database',
  retentionNote: 'Draft retention decision pending review',
  contact: 'owner@demo.sahmati.test',
};
async function request(path: string, method = 'GET', role = 'owner', body?: unknown) {
  return fetch(`${base}/tenants/${A}/register${path}`, {
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
  for (const [role, suffix] of [
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
      [hash, `00000000-0000-4000-8000-00000000000${suffix}`],
    );
    cookies[role!] = `sahmati_session=${token}`;
  }
});
after(async () => {
  await app?.close();
  await admin.query('DELETE FROM identity.sessions WHERE token_hash=ANY($1::text[])', [hashes]);
  await admin.end();
});
test('register validates bounded metadata and accepts owner draft with revision atomically', async () => {
  for (const body of [
    { ...draft, tenantId: B },
    { ...draft, name: 'x'.repeat(121) },
    { ...draft, purposeHi: '' },
    { ...draft, dataCategories: [] },
    { ...draft, status: 'published' },
  ])
    assert.equal((await request('', 'POST', 'owner', body)).status, 400);
  assert.equal((await request('', 'POST', 'owner', { ...draft, name: '  ' })).status, 409);
  const result = await request('', 'POST', 'owner', draft);
  assert.equal(result.status, 201);
  entry = (await result.json()) as RegisterView;
  assert.equal(entry.status, 'draft');
  assert.equal(entry.version, 1);
  assert.deepEqual(
    ((await request(`/${entry.id}/history`).then((r) => r.json())) as RegisterRevision[])[0]?.data,
    draft,
  );
});
test('register scopes tenant and branch, denies staff/viewer writes and platform access', async () => {
  for (const role of ['staff', 'viewer']) {
    assert.equal((await request('', 'GET', role)).status, 200);
    assert.equal((await request('', 'POST', role, draft)).status, 403);
    assert.equal(
      (await request(`/${entry.id}`, 'PATCH', role, { ...draft, version: 1 })).status,
      403,
    );
  }
  for (const role of ['other', 'operator'])
    assert.equal((await request('', 'GET', role)).status, 403);
  const foreign = await fetch(`${base}/tenants/${B}/register/${entry.id}/history`, {
    headers: { cookie: cookies['other']! },
  });
  assert.equal(foreign.status, 404);
  const branch = randomUUID();
  await admin.query('INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3)', [
    A,
    branch,
    'Synthetic second branch',
  ]);
  const id = randomUUID();
  await admin.query(
    'INSERT INTO workspace.register_entries(tenant_id,id,branch_id,data) VALUES($1,$2,$3,$4)',
    [A, id, branch, draft],
  );
  assert.equal((await request(`/${id}/history`)).status, 404);
  assert.equal((await request(`/${id}/notice-preview`)).status, 404);
  assert.equal((await request(`/${id}`, 'PATCH', 'owner', { ...draft, version: 1 })).status, 404);
  assert.equal(
    ((await request('').then((r) => r.json())) as RegisterView[]).some((item) => item.id === id),
    false,
  );
});
test('concurrent register updates accept one version and preserve immutable original revision', async () => {
  const results = await Promise.all([
    request(`/${entry.id}`, 'PATCH', 'owner', { ...draft, name: 'Revision two A', version: 1 }),
    request(`/${entry.id}`, 'PATCH', 'owner', { ...draft, name: 'Revision two B', version: 1 }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const history = (await request(`/${entry.id}/history`).then((r) =>
    r.json(),
  )) as RegisterRevision[];
  assert.deepEqual(
    history.map((r) => r.version),
    [2, 1],
  );
  assert.equal(history[1]?.data.name, draft.name);
  await assert.rejects(
    db.transaction(A, (c) =>
      c.query('UPDATE workspace.register_revisions SET data=$1 WHERE entry_id=$2', [{}, entry.id]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    db.transaction(A, (c) =>
      c.query('DELETE FROM workspace.register_revisions WHERE entry_id=$1', [entry.id]),
    ),
    /permission denied/,
  );
  assert.equal((await db.query('SELECT * FROM workspace.register_entries')).rowCount, 0);
  await assert.rejects(
    db.transaction(B, (c) =>
      c.query(
        'INSERT INTO workspace.register_entries(tenant_id,id,branch_id,data) VALUES($1,$2,$3,$4)',
        [A, randomUUID(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', draft],
      ),
    ),
    /row-level security/,
  );
});
test('revision insert failure rolls back draft edit and version', async () => {
  await admin.query(
    "CREATE FUNCTION workspace.test_fail_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'revision test failure'; END $$; CREATE TRIGGER test_revision_failure BEFORE INSERT ON workspace.register_revisions FOR EACH ROW EXECUTE FUNCTION workspace.test_fail_revision()",
  );
  try {
    assert.equal(
      (await request(`/${entry.id}`, 'PATCH', 'owner', { ...draft, version: 2 })).status,
      500,
    );
    assert.equal(
      (await admin.query('SELECT version FROM workspace.register_entries WHERE id=$1', [entry.id]))
        .rows[0].version,
      2,
    );
  } finally {
    await admin.query(
      'DROP TRIGGER test_revision_failure ON workspace.register_revisions; DROP FUNCTION workspace.test_fail_revision()',
    );
  }
});
test('notice preview is versioned bilingual unreviewed plain text and publishing is unavailable', async () => {
  const en = (await request(`/${entry.id}/notice-preview`).then((r) => r.json())) as NoticePreview;
  const hi = (await request(`/${entry.id}/notice-preview?language=hi`).then((r) =>
    r.json(),
  )) as NoticePreview;
  assert.equal(en.version, 2);
  assert.equal(en.status, 'unreviewed-draft');
  assert.match(en.warning, /not legally reviewed/);
  assert.ok(en.body.includes(draft.purposeEn));
  assert.ok(hi.body.includes(draft.purposeHi));
  assert.equal(hi.language, 'hi');
  assert.equal((await request(`/${entry.id}/notice-preview?language=xx`)).status, 400);
  assert.equal((await request(`/${entry.id}/publish`, 'POST', 'owner', {})).status, 404);
});

test('optional internal references round-trip atomically in revisions without entering notice previews', async () => {
  const withReferences: RegisterData = {
    ...draft,
    hasPaperRecords: true,
    vendorReferences: [
      { name: ' Internal synthetic vendor ', service: ' Internal hosting service ' },
    ],
    storageReferences: [
      { name: ' Internal paper cabinet ', medium: 'paper', location: ' Internal restricted room ' },
    ],
  };
  const created = await request('', 'POST', 'owner', withReferences);
  assert.equal(created.status, 201);
  const item = (await created.json()) as RegisterView;
  assert.deepEqual(item.vendorReferences, [
    { name: 'Internal synthetic vendor', service: 'Internal hosting service' },
  ]);
  assert.equal(item.hasPaperRecords, true);
  const changed = {
    ...withReferences,
    name: 'Synthetic revised reference activity',
    vendorReferences: [{ name: 'Replacement vendor', service: 'Synthetic processing' }],
    version: item.version,
  };
  const updated = await request(`/${item.id}`, 'PATCH', 'owner', changed);
  assert.equal(updated.status, 200);
  assert.equal(
    (await request(`/${item.id}`, 'PATCH', 'owner', { ...changed, vendorReferences: [] })).status,
    409,
  );
  const history = (await request(`/${item.id}/history`).then((r) =>
    r.json(),
  )) as RegisterRevision[];
  assert.equal(history.length, 2);
  assert.deepEqual(history[1]?.data.vendorReferences, item.vendorReferences);
  assert.equal(history[0]?.data.vendorReferences?.[0]?.name, 'Replacement vendor');
  for (const language of ['en', 'hi']) {
    const preview = (await request(`/${item.id}/notice-preview?language=${language}`).then((r) =>
      r.json(),
    )) as NoticePreview;
    for (const secret of [
      'Replacement vendor',
      'Synthetic processing',
      'Internal restricted room',
      'Internal paper cabinet',
    ])
      assert.equal(preview.body.includes(secret), false);
    assert.equal(preview.body.includes('Local synthetic database'), true);
  }
  for (const role of ['staff', 'viewer'])
    assert.equal((await request(`/${item.id}`, 'PATCH', role, changed)).status, 403);
  const foreign = await fetch(`${base}/tenants/${B}/register/${item.id}/history`, {
    headers: { cookie: cookies['other']! },
  });
  assert.equal(foreign.status, 404);
});
test('reference API rejects invalid nested metadata and accepts unknown paper mapping explicitly', async () => {
  for (const body of [
    { ...draft, vendorReferences: [{ name: 'Vendor', service: 'Host', verified: true }] },
    {
      ...draft,
      storageReferences: [{ name: 'Storage', medium: 'unknown', location: 'Somewhere' }],
    },
    { ...draft, vendorReferences: null },
    {
      ...draft,
      vendorReferences: [
        { name: ' VENDOR ', service: 'Host' },
        { name: 'vendor', service: 'host' },
      ],
    },
    {
      ...draft,
      hasPaperRecords: false,
      storageReferences: [{ name: 'Cabinet', medium: 'paper', location: 'Local room' }],
    },
  ])
    assert.equal((await request('', 'POST', 'owner', body)).status, 400);
  const result = await request('', 'POST', 'owner', { ...draft, hasPaperRecords: true });
  assert.equal(result.status, 201);
  const item = (await result.json()) as RegisterView;
  assert.equal(item.hasPaperRecords, true);
  assert.equal('storageReferences' in item, false);
  assert.equal('vendorReferences' in item, false);
});
