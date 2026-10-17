import 'reflect-metadata';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../../src/bootstrap/create-app.js';
import { loadConfig } from '../../src/config/runtime.config.js';
import { hashToken } from '../../src/auth/security-hash.js';
import { Database } from '../../src/database/database.service.js';
import type {
  PreparationRecordView,
  NoticeSnapshotView,
  RegisterView,
  PreparationActionInput,
} from '@sahmati/contracts';
const tenant = '11111111-1111-4111-8111-111111111111',
  otherTenant = '22222222-2222-4222-8222-222222222222';
const branch = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const admin = new Pool({ connectionString: loadConfig().adminUrl });
let app: Awaited<ReturnType<typeof createApp>>, base: string, database: Database;
const cookies: Record<string, string> = {},
  hashes: string[] = [],
  records: string[] = [],
  notices: string[] = [],
  entries: string[] = [];
const template = {
  title: 'Synthetic internal template',
  body: 'Synthetic introduction only.',
  language: 'en',
  sourceKind: 'custom-draft',
};
const contact = { displayName: 'Synthetic privacy team', email: 'owner@demo.sahmati.test' };
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  role = 'owner',
  selectedTenant = tenant,
) {
  return fetch(`${base}/tenants/${selectedTenant}/${path}`, {
    method,
    headers: {
      cookie: cookies[role] ?? '',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function create(
  kind: 'template' | 'contact' = 'template',
  role = 'owner',
  extra: object = {},
) {
  const response = await request(
    `preparation/${kind}s`,
    'POST',
    {
      ...(kind === 'template' ? template : contact),
      version: 0,
      idempotencyKey: randomUUID(),
      ...extra,
    },
    role,
  );
  assert.equal(response.status, 201, await response.clone().text());
  const row = (await response.json()) as PreparationRecordView;
  records.push(row.id);
  return row;
}
async function action(
  row: PreparationRecordView,
  selected: PreparationActionInput['action'],
  extra: object = {},
  role = 'owner',
) {
  return request(
    `preparation/${row.id}/actions`,
    'POST',
    { version: row.version, action: selected, idempotencyKey: randomUUID(), ...extra },
    role,
  );
}
async function reviewed(kind: 'template' | 'contact' = 'template', extra: object = {}) {
  let row = await create(kind, 'owner', extra);
  row = (await (await action(row, 'submit')).json()) as PreparationRecordView;
  const response = await action(row, 'review_internal', {
    comment: 'Synthetic internal readiness review; no legal or ownership verification.',
    internalOnlyAcknowledged: true,
  });
  assert.equal(response.status, 201);
  return response.json() as Promise<PreparationRecordView>;
}
before(async () => {
  app = await createApp(true);
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api`;
  database = app.get(Database);
  for (const [role, suffix] of [
    ['owner', '1'],
    ['staff', '2'],
    ['viewer', '3'],
    ['other', '4'],
    ['operator', '5'],
  ] as const) {
    const token = randomBytes(32).toString('hex'),
      hash = hashToken(token);
    hashes.push(hash);
    await admin.query(
      "INSERT INTO identity.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [hash, `00000000-0000-4000-8000-00000000000${suffix}`],
    );
    cookies[role] = `sahmati_session=${token}`;
  }
});
after(async () => {
  await admin.query('DELETE FROM workspace.notice_commands WHERE notice_id=ANY($1::uuid[])', [
    notices,
  ]);
  await admin.query('DELETE FROM workspace.notice_decisions WHERE notice_id=ANY($1::uuid[])', [
    notices,
  ]);
  await admin.query('DELETE FROM workspace.notice_reviews WHERE notice_id=ANY($1::uuid[])', [
    notices,
  ]);
  await admin.query('DELETE FROM workspace.notice_snapshots WHERE id=ANY($1::uuid[])', [notices]);
  await admin.query('DELETE FROM workspace.preparation_commands WHERE record_id=ANY($1::uuid[])', [
    records,
  ]);
  await admin.query('DELETE FROM workspace.preparation_revisions WHERE record_id=ANY($1::uuid[])', [
    records,
  ]);
  await admin.query('DELETE FROM workspace.preparation_records WHERE id=ANY($1::uuid[])', [
    records,
  ]);
  await admin.query('DELETE FROM workspace.register_pack_sources WHERE entry_id=ANY($1::uuid[])', [
    entries,
  ]);
  await admin.query('DELETE FROM workspace.register_revisions WHERE entry_id=ANY($1::uuid[])', [
    entries,
  ]);
  await admin.query('DELETE FROM workspace.register_entries WHERE id=ANY($1::uuid[])', [entries]);
  await admin.query('DELETE FROM identity.sessions WHERE token_hash=ANY($1::text[])', [hashes]);
  await app?.close();
  await admin.end();
});
test('preparation validates nested inputs and rejects fabricated review/verification metadata', async () => {
  for (const extra of [
    { title: ' ' },
    { body: 'x'.repeat(4001) },
    { language: 'fr' },
    { sourceKind: 'official-approved' },
    { legalReviewStatus: 'approved' },
    { sourcePack: { id: 'education', version: 999 } },
  ])
    assert.equal(
      (
        await request('preparation/templates', 'POST', {
          ...template,
          version: 0,
          idempotencyKey: randomUUID(),
          ...extra,
        })
      ).status,
      400,
    );
  for (const extra of [
    { email: 'bad' },
    { email: null },
    { displayName: ' ' },
    { contactVerification: 'verified' },
  ])
    assert.equal(
      (
        await request('preparation/contacts', 'POST', {
          ...contact,
          version: 0,
          idempotencyKey: randomUUID(),
          ...extra,
        })
      ).status,
      400,
    );
});
test('staff prepare templates, owner controls contact and review, viewers/platform cannot mutate', async () => {
  const row = await create('template', 'staff');
  assert.equal(row.status, 'draft');
  for (const role of ['viewer', 'operator'])
    assert.equal(
      (
        await request(
          'preparation/templates',
          'POST',
          { ...template, version: 0, idempotencyKey: randomUUID() },
          role,
        )
      ).status,
      403,
    );
  assert.equal(
    (
      await request(
        'preparation/contacts',
        'POST',
        { ...contact, version: 0, idempotencyKey: randomUUID() },
        'staff',
      )
    ).status,
    403,
  );
  const submitted = (await (
    await action(row, 'submit', {}, 'staff')
  ).json()) as PreparationRecordView;
  assert.equal(
    (
      await action(
        submitted,
        'review_internal',
        { comment: 'Attempt', internalOnlyAcknowledged: true },
        'staff',
      )
    ).status,
    403,
  );
  assert.equal((await request('preparation', 'GET', undefined, 'anonymous')).status, 401);
});
test('review lifecycle pins content, requires comment/acknowledgement and resets on a new draft', async () => {
  let row = await create();
  const originalHash = row.contentHash;
  row = (await (await action(row, 'submit')).json()) as PreparationRecordView;
  assert.equal((await action(row, 'review_internal', { comment: 'Only internal' })).status, 400);
  assert.equal((await action(row, 'request_changes')).status, 400);
  row = (await (
    await action(row, 'request_changes', { comment: 'Clarify the synthetic introduction.' })
  ).json()) as PreparationRecordView;
  assert.equal(row.status, 'changes_requested');
  row = (await (await action(row, 'submit')).json()) as PreparationRecordView;
  row = (await (
    await action(row, 'review_internal', {
      comment: 'Internal content checked only.',
      internalOnlyAcknowledged: true,
    })
  ).json()) as PreparationRecordView;
  assert.equal(row.status, 'internally_reviewed');
  assert.equal(row.contentHash, originalHash);
  assert.equal(row.legalReviewStatus, 'unreviewed');
  assert.equal(row.contactVerification, 'unverified');
  const edited = await request(`preparation/templates/${row.id}`, 'PUT', {
    ...template,
    body: 'Changed synthetic introduction.',
    version: row.version,
    idempotencyKey: randomUUID(),
  });
  assert.equal(edited.status, 200);
  row = (await edited.json()) as PreparationRecordView;
  assert.equal(row.status, 'draft');
  assert.equal(row.version, 6);
  assert.notEqual(row.contentHash, originalHash);
  assert.equal(row.history.length, 6);
  assert.equal((row.history.at(-1)?.data as { body: string }).body, template.body);
});
test('idempotent commands do not duplicate records and conflicting/concurrent versions reject safely', async () => {
  const payload = { ...template, version: 0, idempotencyKey: randomUUID() };
  const responses = await Promise.all([
    request('preparation/templates', 'POST', payload),
    request('preparation/templates', 'POST', payload),
  ]);
  const values = await Promise.all(
    responses.map((response) => response.json() as Promise<PreparationRecordView>),
  );
  assert.equal(values[0]!.id, values[1]!.id);
  const row = values[0]!;
  records.push(row.id);
  assert.equal(row.history.length, 1);
  assert.equal(
    (await request('preparation/templates', 'POST', { ...payload, title: 'Different' })).status,
    409,
  );
  const edits = await Promise.all(
    ['A', 'B'].map((body) =>
      request(`preparation/templates/${row.id}`, 'PUT', {
        ...template,
        body,
        version: row.version,
        idempotencyKey: randomUUID(),
      }),
    ),
  );
  assert.deepEqual(edits.map((response) => response.status).sort(), [200, 409]);
  let current = (await (await request(`preparation/${row.id}`)).json()) as PreparationRecordView;
  current = (await (await action(current, 'submit')).json()) as PreparationRecordView;
  const decisions = await Promise.all([
    action(current, 'request_changes', { comment: 'Correction' }),
    action(current, 'review_internal', {
      comment: 'Internal only',
      internalOnlyAcknowledged: true,
    }),
  ]);
  assert.deepEqual(decisions.map((response) => response.status).sort(), [201, 409]);
  await assert.rejects(
    database.transaction(tenant, (client) =>
      client.query('UPDATE workspace.preparation_revisions SET comment=$1 WHERE record_id=$2', [
        'rewrite',
        row.id,
      ]),
    ),
    /permission denied/,
  );
});
test('tenant, branch, current membership and raw RLS boundaries protect preparation records', async () => {
  const row = await create();
  assert.equal(
    (await request(`preparation/${row.id}`, 'GET', undefined, 'other', otherTenant)).status,
    404,
  );
  assert.equal((await request('preparation', 'GET', undefined, 'owner', otherTenant)).status, 403);
  const alternate = randomUUID();
  await admin.query('INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3)', [
    tenant,
    alternate,
    'Synthetic separate branch',
  ]);
  try {
    await admin.query(
      'UPDATE identity.memberships SET branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
      [alternate, tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal((await request(`preparation/${row.id}`, 'GET', undefined, 'staff')).status, 404);
    await admin.query(
      'UPDATE identity.memberships SET active=false WHERE tenant_id=$1 AND user_id=$2',
      [tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal((await request('preparation', 'GET', undefined, 'staff')).status, 403);
  } finally {
    await admin.query(
      'UPDATE identity.memberships SET branch_id=$1,active=true WHERE tenant_id=$2 AND user_id=$3',
      [branch, tenant, '00000000-0000-4000-8000-000000000002'],
    );
    await admin.query('DELETE FROM workspace.branches WHERE id=$1', [alternate]);
  }
  for (const context of [null, otherTenant])
    assert.equal(
      (
        await database.transaction(context, (client) =>
          client.query('SELECT id FROM workspace.preparation_records WHERE id=$1', [row.id]),
        )
      ).rows.length,
      0,
    );
});
test('command persistence failure rolls back preparation content and immutable revision atomically', async () => {
  const key = randomUUID();
  const before = await admin.query(
    'SELECT count(*)::int AS total FROM workspace.preparation_records',
  );
  await admin.query(
    `CREATE FUNCTION workspace.preparation_command_failure_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key='${key}'::uuid THEN RAISE EXCEPTION 'synthetic command failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    'CREATE TRIGGER preparation_failure BEFORE INSERT ON workspace.preparation_commands FOR EACH ROW EXECUTE FUNCTION workspace.preparation_command_failure_fixture()',
  );
  try {
    assert.equal(
      (
        await request('preparation/templates', 'POST', {
          ...template,
          version: 0,
          idempotencyKey: key,
        })
      ).status,
      500,
    );
    assert.equal(
      (await admin.query('SELECT count(*)::int AS total FROM workspace.preparation_records'))
        .rows[0].total,
      before.rows[0].total,
    );
  } finally {
    await admin.query('DROP TRIGGER preparation_failure ON workspace.preparation_commands');
    await admin.query('DROP FUNCTION workspace.preparation_command_failure_fixture()');
  }
});
test('notice snapshots pin reviewed preparation versions, exclude internal metadata and reject stale publication', async () => {
  const selectedTemplate = await reviewed(),
    selectedContact = await reviewed('contact');
  const registerResponse = await request('register', 'POST', {
    name: 'Prepared notice source',
    purposeEn: 'Synthetic purpose',
    purposeHi: 'काल्पनिक उद्देश्य',
    dataCategories: ['Synthetic category'],
    storageLocation: 'Synthetic store',
    retentionNote: 'Unreviewed',
    contact: 'Old draft contact',
    vendorReferences: [{ name: 'Private vendor', service: 'Private service' }],
  });
  assert.equal(registerResponse.status, 201);
  const entry = (await registerResponse.json()) as RegisterView;
  entries.push(entry.id);
  const preparation = {
    templateId: selectedTemplate.id,
    templateVersion: selectedTemplate.version,
    contactId: selectedContact.id,
    contactVersion: selectedContact.version,
  };
  const payload = { entryId: entry.id, entryVersion: entry.version, language: 'en', preparation };
  const educationTemplate = await reviewed('template', { sourceKind: 'education-sample' });
  assert.equal(
    (
      await request('notices', 'POST', {
        ...payload,
        preparation: {
          ...preparation,
          templateId: educationTemplate.id,
          templateVersion: educationTemplate.version,
        },
        idempotencyKey: randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('notices', 'POST', {
        ...payload,
        preparation: { ...preparation, contactVersion: selectedContact.version + 1 },
        idempotencyKey: randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('notices', 'POST', {
        ...payload,
        preparation: { ...preparation, contactId: selectedTemplate.id },
        idempotencyKey: randomUUID(),
      })
    ).status,
    409,
  );
  const before = await admin.query('SELECT count(*)::int AS total FROM workspace.outbox');
  const snapshots: NoticeSnapshotView[] = [];
  for (let i = 0; i < 2; i++) {
    const response = await request('notices', 'POST', { ...payload, idempotencyKey: randomUUID() });
    assert.equal(response.status, 201, await response.clone().text());
    const snapshot = (await response.json()) as NoticeSnapshotView;
    snapshots.push(snapshot);
    notices.push(snapshot.id);
    assert.equal(snapshot.preparationSource?.contactVerification, 'unverified');
    assert.ok(snapshot.preview.body.includes(contact.email));
    assert.ok(snapshot.preview.body.startsWith(template.body));
    assert.ok(!snapshot.preview.body.includes('Private vendor'));
  }
  const publish = {
    version: 1,
    decision: 'publish_sample',
    sampleOnlyAcknowledged: true,
    idempotencyKey: randomUUID(),
  };
  assert.equal(
    (await request(`notices/${snapshots[0]!.id}/decisions`, 'POST', publish)).status,
    201,
  );
  assert.equal(
    (await request('notices', 'POST', { ...payload, language: 'hi', idempotencyKey: randomUUID() }))
      .status,
    409,
  );
  assert.equal(
    (
      await request('notices', 'POST', {
        ...payload,
        preparation: { ...preparation, contactVerification: 'verified' },
        idempotencyKey: randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`preparation/templates/${selectedTemplate.id}`, 'PUT', {
        ...template,
        body: 'New draft',
        version: selectedTemplate.version,
        idempotencyKey: randomUUID(),
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('notices', 'POST', { ...payload, idempotencyKey: randomUUID() })).status,
    409,
  );
  assert.equal(
    (
      await request(`notices/${snapshots[1]!.id}/decisions`, 'POST', {
        ...publish,
        idempotencyKey: randomUUID(),
      })
    ).status,
    409,
  );
  const persisted = (await (
    await request(`notices/${snapshots[0]!.id}`)
  ).json()) as NoticeSnapshotView;
  assert.equal(persisted.preview.body, snapshots[0]!.preview.body);
  assert.equal(persisted.legalReviewStatus, 'unreviewed');
  assert.equal(
    (await admin.query('SELECT count(*)::int AS total FROM workspace.outbox')).rows[0].total,
    before.rows[0].total,
  );
});
