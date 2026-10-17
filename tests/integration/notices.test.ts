import 'reflect-metadata';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../../src/api/app.js';
import { loadConfig } from '../../src/api/config.js';
import { Database } from '../../src/api/database.js';
import { hashToken } from '../../src/api/security.js';
import type { RegisterData, RegisterView, NoticeSnapshotView } from '@sahmati/contracts';
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222';
const owner = '00000000-0000-4000-8000-000000000001';
const admin = new Pool({ connectionString: loadConfig().adminUrl });
let app: Awaited<ReturnType<typeof createApp>>, base: string, db: Database;
const cookies: Record<string, string> = {},
  hashes: string[] = [],
  entryIds: string[] = [];
const data: RegisterData = {
  name: 'Notice lifecycle synthetic register',
  purposeEn: 'Review a synthetic application',
  purposeHi: 'काल्पनिक आवेदन की समीक्षा',
  dataCategories: ['Synthetic reference'],
  storageLocation: 'Local synthetic store',
  retentionNote: 'Unreviewed retention draft',
  contact: 'owner@demo.sahmati.test',
  vendorReferences: [
    { name: 'Private internal vendor reference', service: 'Internal access review' },
  ],
  storageReferences: [
    { name: 'Private internal vault', location: 'Internal synthetic location', medium: 'digital' },
  ],
  hasPaperRecords: true,
};
async function api(path: string, method = 'GET', role = 'owner', body?: unknown, tenant = A) {
  return fetch(`${base}/tenants/${tenant}/${path}`, {
    method,
    headers: {
      cookie: cookies[role] ?? '',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function entry() {
  const response = await api('register', 'POST', 'owner', data);
  assert.equal(response.status, 201);
  const value = (await response.json()) as RegisterView;
  entryIds.push(value.id);
  return value;
}
async function submit(
  source: RegisterView,
  role = 'owner',
  key = randomUUID(),
  language: 'en' | 'hi' = 'en',
) {
  return api('notices', 'POST', role, {
    entryId: source.id,
    entryVersion: source.version,
    language,
    idempotencyKey: key,
  });
}
async function notice(source: RegisterView, role = 'owner') {
  const response = await submit(source, role);
  assert.equal(response.status, 201);
  return response.json() as Promise<NoticeSnapshotView>;
}
async function decide(
  snapshot: NoticeSnapshotView,
  decision: 'request_changes' | 'publish_sample',
  extra: Record<string, unknown> = {},
  role = 'owner',
) {
  return api(`notices/${snapshot.id}/decisions`, 'POST', role, {
    version: snapshot.reviewVersion,
    decision,
    idempotencyKey: randomUUID(),
    ...extra,
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
    const token = randomBytes(32).toString('hex'),
      hash = hashToken(token);
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
  if (entryIds.length) {
    await admin.query(
      'DELETE FROM workspace.notice_commands WHERE notice_id IN (SELECT id FROM workspace.notice_snapshots WHERE entry_id=ANY($1::uuid[]))',
      [entryIds],
    );
    await admin.query(
      'DELETE FROM workspace.notice_decisions WHERE notice_id IN (SELECT id FROM workspace.notice_snapshots WHERE entry_id=ANY($1::uuid[]))',
      [entryIds],
    );
    await admin.query(
      'DELETE FROM workspace.notice_reviews WHERE notice_id IN (SELECT id FROM workspace.notice_snapshots WHERE entry_id=ANY($1::uuid[]))',
      [entryIds],
    );
    await admin.query('DELETE FROM workspace.notice_snapshots WHERE entry_id=ANY($1::uuid[])', [
      entryIds,
    ]);
    await admin.query('DELETE FROM workspace.register_revisions WHERE entry_id=ANY($1::uuid[])', [
      entryIds,
    ]);
    await admin.query(
      'DELETE FROM workspace.register_pack_sources WHERE entry_id=ANY($1::uuid[])',
      [entryIds],
    );
    await admin.query('DELETE FROM workspace.register_entries WHERE id=ANY($1::uuid[])', [
      entryIds,
    ]);
  }
  await admin.query('DELETE FROM identity.sessions WHERE token_hash=ANY($1::text[])', [hashes]);
  await admin.end();
});
test('tenant roles and payload validation protect all notice routes', async () => {
  const source = await entry();
  assert.equal((await api('notices', 'GET', 'anonymous')).status, 401);
  for (const role of ['other', 'operator'])
    assert.equal((await api('notices', 'GET', role)).status, 403);
  assert.equal((await submit(source, 'viewer')).status, 403);
  assert.equal(
    (
      await api('notices', 'POST', 'owner', {
        entryId: source.id,
        entryVersion: source.version,
        language: 'en',
        idempotencyKey: randomUUID(),
        tenantId: B,
      })
    ).status,
    400,
  );
  const snapshot = await notice(source, 'staff');
  assert.equal((await decide(snapshot, 'request_changes', {}, 'staff')).status, 403);
  assert.equal((await decide(snapshot, 'request_changes', {}, 'viewer')).status, 403);
  assert.equal((await api(`notices/${snapshot.id}`, 'GET', 'other', undefined, B)).status, 404);
  assert.equal((await api(`notices/${snapshot.id}`, 'GET', 'viewer')).status, 200);
  assert.equal((await decide(snapshot, 'publish_sample')).status, 400);
  assert.equal(
    (await decide(snapshot, 'request_changes', { comment: 'x'.repeat(1001) })).status,
    400,
  );
});
test('submission captures an immutable version/language/provenance and excludes internal references from notice copy', async () => {
  const source = await entry();
  await admin.query(
    "INSERT INTO workspace.register_pack_sources(tenant_id,entry_id,pack_id,pack_version) VALUES($1,$2,'education',1)",
    [A, source.id],
  );
  const key = randomUUID();
  const responses = await Promise.all([
    submit(source, 'owner', key, 'hi'),
    submit(source, 'owner', key, 'hi'),
  ]);
  assert.deepEqual(
    responses.map((row) => row.status),
    [201, 201],
  );
  const snapshots = await Promise.all(
    responses.map((row) => row.json() as Promise<NoticeSnapshotView>),
  );
  assert.deepEqual(snapshots[0], snapshots[1]);
  const snapshot = snapshots[0]!;
  assert.equal(snapshot.status, 'in_review');
  assert.equal(snapshot.reviewVersion, 1);
  assert.equal(snapshot.legalReviewStatus, 'unreviewed');
  assert.equal(snapshot.mode, 'local-sample');
  assert.equal(snapshot.entryVersion, source.version);
  assert.equal(snapshot.language, 'hi');
  assert.deepEqual(snapshot.sourcePack, {
    id: 'education',
    version: 1,
    reviewStatus: 'unreviewed',
  });
  assert.ok(snapshot.preview.body.includes(data.purposeHi));
  assert.ok(snapshot.preview.body.includes('\n'));
  assert.equal(JSON.stringify(snapshot.preview).includes('Private internal'), false);
  assert.equal(snapshot.registerData.hasPaperRecords, true);
  assert.equal((await submit(source, 'owner', key, 'en')).status, 409);
  await assert.rejects(
    db.transaction(A, (c) =>
      c.query('UPDATE workspace.notice_snapshots SET preview=$2 WHERE id=$1', [snapshot.id, {}]),
    ),
    /permission denied/,
  );
});
test('sample publication is explicit, optimistic, idempotent and remains legally unreviewed', async () => {
  const source = await entry(),
    snapshot = await notice(source),
    key = randomUUID();
  assert.equal(
    (await decide(snapshot, 'publish_sample', { version: 99, sampleOnlyAcknowledged: true }))
      .status,
    409,
  );
  const payload = {
    version: 1,
    decision: 'publish_sample',
    sampleOnlyAcknowledged: true,
    idempotencyKey: key,
    comment: 'Internal sample check only',
  };
  const responses = await Promise.all([
    api(`notices/${snapshot.id}/decisions`, 'POST', 'owner', payload),
    api(`notices/${snapshot.id}/decisions`, 'POST', 'owner', payload),
  ]);
  assert.deepEqual(
    responses.map((row) => row.status),
    [201, 201],
  );
  const values = await Promise.all(
    responses.map((row) => row.json() as Promise<NoticeSnapshotView>),
  );
  assert.deepEqual(values[0], values[1]);
  const published = values[0]!;
  assert.equal(published.status, 'sample_published');
  assert.equal(published.reviewVersion, 2);
  assert.equal(published.decisions.length, 1);
  assert.equal(published.legalReviewStatus, 'unreviewed');
  assert.equal(published.preview.status, 'unreviewed-draft');
  assert.equal(
    (
      await api(`notices/${snapshot.id}/decisions`, 'POST', 'owner', {
        ...payload,
        comment: 'different',
      })
    ).status,
    409,
  );
  assert.equal((await decide(snapshot, 'request_changes')).status, 409);
  await assert.rejects(
    db.transaction(A, (c) =>
      c.query('DELETE FROM workspace.notice_decisions WHERE notice_id=$1', [snapshot.id]),
    ),
    /permission denied/,
  );
});
test('changed register source blocks submission and sample publication; immutable history survives changes request', async () => {
  const source = await entry(),
    snapshot = await notice(source);
  const changed = await api(`register/${source.id}`, 'PATCH', 'owner', {
    ...data,
    name: 'Changed source name',
    version: source.version,
  });
  assert.equal(changed.status, 200);
  const updated = (await changed.json()) as RegisterView;
  assert.equal((await submit(source)).status, 409);
  assert.equal(
    (await decide(snapshot, 'publish_sample', { sampleOnlyAcknowledged: true })).status,
    409,
  );
  const result = await decide(snapshot, 'request_changes', {
    comment: 'Create a new snapshot from the updated register',
  });
  assert.equal(result.status, 201);
  const reviewed = (await result.json()) as NoticeSnapshotView;
  assert.equal(reviewed.status, 'changes_requested');
  assert.equal(reviewed.preview.title, data.name);
  assert.equal(reviewed.registerData.name, data.name);
  const fresh = await notice(updated);
  assert.equal(fresh.entryVersion, 2);
  assert.equal(
    (await decide(fresh, 'publish_sample', { sampleOnlyAcknowledged: true })).status,
    201,
  );
});
test('independent concurrent owner decisions resolve once and append only one history event', async () => {
  const source = await entry(),
    snapshot = await notice(source);
  const results = await Promise.all([
    decide(snapshot, 'request_changes'),
    decide(snapshot, 'publish_sample', { sampleOnlyAcknowledged: true }),
  ]);
  assert.deepEqual(results.map((row) => row.status).sort(), [201, 409]);
  const current = (await (await api(`notices/${snapshot.id}`)).json()) as NoticeSnapshotView;
  assert.equal(current.reviewVersion, 2);
  assert.equal(current.decisions.length, 1);
});
test('command persistence failure rolls snapshot/review and decision changes back atomically', async () => {
  const source = await entry(),
    snapshot = await notice(source);
  await admin.query(
    "CREATE FUNCTION workspace.test_notice_command_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test notice rollback'; END $$; CREATE TRIGGER test_notice_command_failure BEFORE INSERT ON workspace.notice_commands FOR EACH ROW EXECUTE FUNCTION workspace.test_notice_command_failure()",
  );
  try {
    const before = await admin.query(
      'SELECT count(*)::int AS total FROM workspace.notice_snapshots WHERE entry_id=$1',
      [source.id],
    );
    assert.equal((await submit(source)).status, 500);
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int AS total FROM workspace.notice_snapshots WHERE entry_id=$1',
          [source.id],
        )
      ).rows[0].total,
      before.rows[0].total,
    );
    assert.equal(
      (await decide(snapshot, 'publish_sample', { sampleOnlyAcknowledged: true })).status,
      500,
    );
    const current = (await (await api(`notices/${snapshot.id}`)).json()) as NoticeSnapshotView;
    assert.equal(current.status, 'in_review');
    assert.equal(current.reviewVersion, 1);
    assert.equal(current.decisions.length, 0);
  } finally {
    await admin.query(
      'DROP TRIGGER test_notice_command_failure ON workspace.notice_commands; DROP FUNCTION workspace.test_notice_command_failure()',
    );
  }
});
test('branch boundaries prevent source submission or notice disclosure within a tenant', async () => {
  const foreignBranch = randomUUID(),
    foreignEntry = randomUUID(),
    foreignNotice = randomUUID();
  entryIds.push(foreignEntry);
  await admin.query('INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3)', [
    A,
    foreignBranch,
    'Synthetic hidden branch',
  ]);
  try {
    await admin.query(
      'INSERT INTO workspace.register_entries(tenant_id,id,branch_id,data) VALUES($1,$2,$3,$4)',
      [A, foreignEntry, foreignBranch, data],
    );
    await admin.query(
      "INSERT INTO workspace.notice_snapshots(tenant_id,id,branch_id,entry_id,entry_version,language,mode,legal_review_status,register_data,preview,submitted_by) VALUES($1,$2,$3,$4,1,'en','local-sample','unreviewed',$5,$6,$7)",
      [
        A,
        foreignNotice,
        foreignBranch,
        foreignEntry,
        data,
        { title: 'Hidden branch sample' },
        owner,
      ],
    );
    await admin.query('INSERT INTO workspace.notice_reviews(tenant_id,notice_id) VALUES($1,$2)', [
      A,
      foreignNotice,
    ]);
    assert.equal(
      (
        await api('notices', 'POST', 'owner', {
          entryId: foreignEntry,
          entryVersion: 1,
          language: 'en',
          idempotencyKey: randomUUID(),
        })
      ).status,
      404,
    );
    assert.equal((await api(`notices/${foreignNotice}`)).status, 404);
    assert.equal((await api(`notices/${foreignNotice}/export.pdf`)).status, 404);
    assert.equal((await api(`notices/${foreignNotice}/qr.png`)).status, 404);
    assert.equal(
      (
        await api(`notices/${foreignNotice}/decisions`, 'POST', 'owner', {
          version: 1,
          decision: 'request_changes',
          idempotencyKey: randomUUID(),
        })
      ).status,
      404,
    );
    const list = (await (await api('notices')).json()) as NoticeSnapshotView[];
    assert.equal(
      list.some((row) => row.id === foreignNotice),
      false,
    );
  } finally {
    await admin.query('DELETE FROM workspace.notice_reviews WHERE notice_id=$1', [foreignNotice]);
    await admin.query('DELETE FROM workspace.notice_snapshots WHERE id=$1', [foreignNotice]);
    await admin.query('DELETE FROM workspace.register_entries WHERE id=$1', [foreignEntry]);
    await admin.query('DELETE FROM workspace.branches WHERE id=$1', [foreignBranch]);
  }
});

test('PDF/QR exports require owner membership and explicit sample publication without a public route', async () => {
  const source = await entry();
  const snapshot = await notice(source);
  for (const suffix of ['export.pdf', 'qr.png']) {
    assert.equal((await api(`notices/${snapshot.id}/${suffix}`)).status, 409);
    assert.equal((await api(`notices/${snapshot.id}/${suffix}`, 'GET', 'viewer')).status, 403);
    assert.equal((await api(`notices/${snapshot.id}/${suffix}`, 'GET', 'staff')).status, 403);
    assert.equal((await api(`notices/${snapshot.id}/${suffix}`, 'GET', 'other')).status, 403);
    assert.equal(
      (await api(`notices/${snapshot.id}/${suffix}`, 'GET', 'other', undefined, B)).status,
      404,
    );
    assert.equal((await api(`notices/${snapshot.id}/${suffix}`, 'GET', 'anonymous')).status, 401);
  }
  assert.equal(
    (
      await decide(snapshot, 'publish_sample', {
        sampleOnlyAcknowledged: true,
        comment: 'Synthetic local review only',
      })
    ).status,
    201,
  );
  const pdf = await api(`notices/${snapshot.id}/export.pdf`);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type') ?? '', /application\/pdf/);
  assert.match(pdf.headers.get('content-disposition') ?? '', /attachment/);
  assert.equal(pdf.headers.get('cache-control'), 'no-store');
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    '%PDF',
  );
  const qr = await api(`notices/${snapshot.id}/qr.png`);
  assert.equal(qr.status, 200);
  assert.match(qr.headers.get('content-type') ?? '', /image\/png/);
  assert.deepEqual(
    [...Buffer.from(await qr.arrayBuffer()).subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  assert.equal((await fetch(`${base}/notices/${snapshot.id}`)).status, 404);
});
