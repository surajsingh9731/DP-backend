import 'reflect-metadata';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../../src/bootstrap/create-app.js';
import { loadConfig } from '../../src/config/runtime.config.js';
import { hashToken } from '../../src/auth/security-hash.js';
import { Database } from '../../src/database/database.service.js';
import { followupDigest } from '../../src/followups/followup-locations.js';
import type {
  FollowupTask,
  FollowupDetail,
  ConsentOffer,
  ConsentParticipant,
  ConsentReceipt,
  PreparationRecordView,
  RegisterView,
  NoticeSnapshotView,
} from '@sahmati/contracts';
const tenant = '11111111-1111-4111-8111-111111111111',
  otherTenant = '22222222-2222-4222-8222-222222222222',
  branch = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const admin = new Pool({ connectionString: loadConfig().adminUrl });
let app: Awaited<ReturnType<typeof createApp>>,
  base: string,
  db: Database,
  notice: NoticeSnapshotView,
  entry: RegisterView,
  preparedTemplate: PreparationRecordView;
const cookies: Record<string, string> = {},
  hashes: string[] = [],
  records: string[] = [];
const purposes = [
  { id: randomUUID(), labelEn: 'Synthetic updates', labelHi: 'काल्पनिक समाचार' },
  { id: randomUUID(), labelEn: 'Synthetic reports', labelHi: 'काल्पनिक रिपोर्ट' },
];
const template = {
  title: 'Synthetic consent notice',
  body: 'Two declared synthetic test options: updates and reports.',
  language: 'en',
  sourceKind: 'custom-draft',
};
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  role = 'owner',
  participantCookie = '',
  selectedTenant = tenant,
) {
  return fetch(`${base}/tenants/${selectedTenant}/${path}`, {
    method,
    headers: {
      cookie: [cookies[role] ?? '', participantCookie].filter(Boolean).join('; '),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function prepared(kind: 'template' | 'contact') {
  const data =
    kind === 'template'
      ? template
      : { displayName: 'Synthetic privacy team', email: 'owner@demo.sahmati.test' };
  let response = await request(`preparation/${kind}s`, 'POST', {
    ...data,
    version: 0,
    idempotencyKey: randomUUID(),
  });
  assert.equal(response.status, 201, await response.clone().text());
  let row = (await response.json()) as PreparationRecordView;
  records.push(row.id);
  response = await request(`preparation/${row.id}/actions`, 'POST', {
    version: row.version,
    action: 'submit',
    idempotencyKey: randomUUID(),
  });
  row = (await response.json()) as PreparationRecordView;
  response = await request(`preparation/${row.id}/actions`, 'POST', {
    version: row.version,
    action: 'review_internal',
    comment: 'Synthetic only; no legal or contact assurance.',
    internalOnlyAcknowledged: true,
    idempotencyKey: randomUUID(),
  });
  assert.equal(response.status, 201);
  return response.json() as Promise<PreparationRecordView>;
}
async function offer(extra: object = {}): Promise<ConsentOffer> {
  const response = await request('consent-sandbox/offers', 'POST', {
    noticeId: notice.id,
    purposes,
    syntheticOnlyAcknowledged: true,
    idempotencyKey: randomUUID(),
    ...extra,
  });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json() as Promise<ConsentOffer>;
}
async function start(selected: ConsentOffer, role = 'owner') {
  const response = await request(
    'consent-sandbox/sessions',
    'POST',
    { offerId: selected.id, syntheticAdultAcknowledged: true },
    role,
  );
  assert.equal(response.status, 201, await response.clone().text());
  const cookie = response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const participant = (await response.json()) as ConsentParticipant;
  assert.ok(cookie.includes(`/sessions/${participant.id}`));
  assert.ok(!('token' in participant));
  return { participant, cookie: cookie.split(';')[0]!, header: cookie, role };
}
function payload(
  selected: ConsentOffer,
  decisions: ('allow' | 'decline')[] = ['allow', 'decline'],
) {
  return {
    offerId: selected.id,
    offerVersion: selected.version,
    catalogHash: selected.catalogHash,
    interfaceLanguage: 'hi',
    choices: purposes.map((p, i) => ({ purposeId: p.id, decision: decisions[i] })),
    syntheticOnlyAcknowledged: true,
    idempotencyKey: randomUUID(),
  };
}
async function submit(session: Awaited<ReturnType<typeof start>>, body: unknown) {
  return request(
    `consent-sandbox/sessions/${session.participant.id}/choices`,
    'POST',
    body,
    session.role,
    session.cookie,
  );
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
      "INSERT INTO identity.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [hash, `00000000-0000-4000-8000-00000000000${suffix}`],
    );
    cookies[role!] = `sahmati_session=${token}`;
  }
  preparedTemplate = await prepared('template');
  const contact = await prepared('contact');
  const response = await request('register', 'POST', {
    name: 'Synthetic consent source',
    purposeEn: 'Synthetic updates and reports',
    purposeHi: 'काल्पनिक समाचार और रिपोर्ट',
    dataCategories: ['Synthetic category'],
    storageLocation: 'Synthetic store',
    hasPaperRecords: true,
    storageReferences: [
      { name: 'Synthetic digital store', medium: 'digital', location: 'Synthetic store' },
      { name: 'Synthetic paper cupboard', medium: 'paper', location: 'Sample reception' },
    ],
    retentionNote: 'Unreviewed',
    contact: 'Synthetic draft contact',
    vendorReferences: [{ name: 'Private internal vendor', service: 'Internal only' }],
  });
  assert.equal(response.status, 201);
  entry = (await response.json()) as RegisterView;
  const snapshot = await request('notices', 'POST', {
    entryId: entry.id,
    entryVersion: entry.version,
    language: 'en',
    preparation: {
      templateId: preparedTemplate.id,
      templateVersion: preparedTemplate.version,
      contactId: contact.id,
      contactVersion: contact.version,
    },
    idempotencyKey: randomUUID(),
  });
  assert.equal(snapshot.status, 201);
  notice = (await snapshot.json()) as NoticeSnapshotView;
  assert.equal(
    (
      await request(`notices/${notice.id}/decisions`, 'POST', {
        version: 1,
        decision: 'publish_sample',
        sampleOnlyAcknowledged: true,
        idempotencyKey: randomUUID(),
      })
    ).status,
    201,
  );
});
after(async () => {
  if (notice) {
    const rightsFilter =
      'session_id IN (SELECT id FROM workspace.consent_participants WHERE offer_id IN (SELECT id FROM workspace.consent_offers WHERE notice_id=$1))';
    await admin.query(
      `DELETE FROM workspace.rights_events WHERE request_id IN (SELECT id FROM workspace.rights_requests WHERE ${rightsFilter})`,
      [notice.id],
    );
    await admin.query(`DELETE FROM workspace.rights_requests WHERE ${rightsFilter}`, [notice.id]);

    await admin.query(
      'DELETE FROM workspace.followup_commands WHERE idempotency_key=ANY($1::uuid[])',
      [commandKeys],
    );
    for (const table of ['check_reviews', 'check_evaluations'])
      await admin.query(
        `DELETE FROM workspace.${table} WHERE task_id IN (SELECT id FROM workspace.followup_tasks WHERE receipt_id IN (SELECT id FROM workspace.consent_receipts WHERE data->'offer'->'notice'->>'id'=$1))`,
        [notice.id],
      );
    const taskFilter =
      "receipt_id IN (SELECT id FROM workspace.consent_receipts WHERE data->'offer'->'notice'->>'id'=$1)";
    await admin.query(
      `DELETE FROM workspace.followup_events WHERE task_id IN (SELECT id FROM workspace.followup_tasks WHERE ${taskFilter})`,
      [notice.id],
    );
    await admin.query(`DELETE FROM workspace.followup_tasks WHERE ${taskFilter}`, [notice.id]);
    await admin.query(
      "DELETE FROM workspace.consent_commands WHERE response->'notice'->>'id'=$1 OR response->'offer'->'notice'->>'id'=$1",
      [notice.id],
    );
    await admin.query(
      'DELETE FROM workspace.consent_receipts WHERE session_id IN (SELECT id FROM workspace.consent_participants WHERE offer_id IN (SELECT id FROM workspace.consent_offers WHERE notice_id=$1))',
      [notice.id],
    );
    await admin.query(
      'DELETE FROM workspace.consent_participants WHERE offer_id IN (SELECT id FROM workspace.consent_offers WHERE notice_id=$1)',
      [notice.id],
    );
    await admin.query('DELETE FROM workspace.consent_offers WHERE notice_id=$1', [notice.id]);
    for (const table of ['notice_commands', 'notice_decisions', 'notice_reviews'])
      await admin.query(`DELETE FROM workspace.${table} WHERE notice_id=$1`, [notice.id]);
    await admin.query('DELETE FROM workspace.notice_snapshots WHERE id=$1', [notice.id]);
  }
  for (const table of ['preparation_commands', 'preparation_revisions'])
    await admin.query(`DELETE FROM workspace.${table} WHERE record_id=ANY($1::uuid[])`, [records]);
  await admin.query('DELETE FROM workspace.preparation_records WHERE id=ANY($1::uuid[])', [
    records,
  ]);
  if (entry) {
    for (const table of ['register_pack_sources', 'register_revisions'])
      await admin.query(`DELETE FROM workspace.${table} WHERE entry_id=$1`, [entry.id]);
    await admin.query('DELETE FROM workspace.register_entries WHERE id=$1', [entry.id]);
  }
  await admin.query('DELETE FROM identity.sessions WHERE token_hash=ANY($1::text[])', [hashes]);
  await app?.close();
  await admin.end();
});

const commandKeys: string[] = [];
async function batch() {
  const selected = await offer(),
    session = await start(selected);
  const first = await submit(session, payload(selected, ['allow', 'allow']));
  assert.equal(first.status, 201);
  const response = await request(
    `consent-sandbox/sessions/${session.participant.id}/withdraw`,
    'POST',
    {
      version: 1,
      purposeIds: [purposes[0]!.id],
      interfaceLanguage: 'en',
      idempotencyKey: randomUUID(),
    },
    'owner',
    session.cookie,
  );
  assert.equal(response.status, 201, await response.clone().text());
  const receipt = (await response.json()) as ConsentReceipt;
  const rows = await admin.query('SELECT data FROM workspace.followup_tasks WHERE receipt_id=$1', [
    receipt.id,
  ]);
  return { receipt, session, tasks: rows.rows.map((row) => row.data as FollowupTask) };
}
async function act(task: FollowupTask, action: string, extra: object = {}, role = 'owner') {
  const key = randomUUID();
  commandKeys.push(key);
  return request(
    `followups/${task.id}/actions`,
    'POST',
    {
      version: task.version,
      action,
      note: 'Synthetic manual review only.',
      evidenceRefs: ['sample-evidence:fixture'],
      syntheticOnlyAcknowledged: true,
      idempotencyKey: key,
      ...extra,
    },
    role,
  );
}
async function reconcile(receiptId: string, key = randomUUID(), role = 'owner') {
  commandKeys.push(key);
  return request(
    'followups/from-receipt',
    'POST',
    { receiptId, syntheticOnlyAcknowledged: true, idempotencyKey: key },
    role,
  );
}
async function taskDetail(task: FollowupTask, role = 'owner') {
  const response = await request(`followups/${task.id}`, 'GET', undefined, role);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json() as Promise<FollowupDetail>;
}

test('withdrawal atomically creates one candidate per saved place with receipt/version/purpose linkage and unknown completeness', async () => {
  const { receipt, tasks } = await batch();
  assert.equal(tasks.length, 4);
  assert.deepEqual(tasks.map((t) => t.location.kind).sort(), [
    'digital',
    'paper',
    'unmapped',
    'vendor',
  ]);
  for (const task of tasks) {
    assert.equal(task.receiptId, receipt.id);
    assert.equal(task.receiptHash, receipt.receiptHash);
    assert.equal(task.noticeId, notice.id);
    assert.equal(task.entryVersion, entry.version);
    assert.deepEqual(task.withdrawnPurposeIds, [purposes[0]!.id]);
    assert.equal(task.responsibleRole, 'owner');
    assert.equal(task.assignee, null);
    const detail = await taskDetail(task);
    assert.equal(detail.history.length, 1);
    assert.equal(detail.history[0]!.action, 'created');
  }
  assert.equal(receipt.deletionStatus, 'not-performed');
  assert.equal(tasks.find((t) => t.location.kind === 'unmapped')?.status, 'unknown');
});
test('reconciliation and concurrent retries reuse tasks; same key with a different receipt is rejected', async () => {
  const { receipt, tasks } = await batch(),
    key = randomUUID();
  const responses = await Promise.all([
    reconcile(receipt.id, key),
    reconcile(receipt.id, key),
    reconcile(receipt.id),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201, 201],
  );
  for (const response of responses)
    assert.deepEqual(
      ((await response.json()) as FollowupTask[]).map((t) => t.id).sort(),
      tasks.map((t) => t.id).sort(),
    );
  assert.equal((await reconcile(randomUUID(), key)).status, 409);
  assert.equal((await reconcile(receipt.id, randomUUID(), 'staff')).status, 403);
});
test('known place state distinguishes request record, completion declaration and independent manual review without changing other tasks or receipt', async () => {
  const { tasks, receipt } = await batch();
  let task = tasks.find((t) => t.location.kind === 'vendor')!;
  const before = (await admin.query('SELECT count(*)::int AS total FROM workspace.outbox')).rows[0]
    .total;
  task = (await (
    await act(task, 'assign', { assigneeId: '00000000-0000-4000-8000-000000000002' })
  ).json()) as FollowupTask;
  task = (await (await act(task, 'record_request', {}, 'staff')).json()) as FollowupTask;
  assert.equal(task.status, 'request_recorded');
  task = (await (
    await act(task, 'declare_complete', { evidenceRefs: ['sample-evidence:staff-claim'] }, 'staff')
  ).json()) as FollowupTask;
  assert.equal(task.status, 'completion_declared');
  assert.equal(
    (await act(task, 'verify', { evidenceRefs: ['sample-evidence:independent'] }, 'staff')).status,
    403,
  );
  assert.equal(
    (await act(task, 'verify', { evidenceRefs: ['sample-evidence:staff-claim'] })).status,
    400,
  );
  const reviewed = await act(task, 'verify', { evidenceRefs: ['sample-evidence:owner-review'] });
  assert.equal(reviewed.status, 201, await reviewed.clone().text());
  task = (await reviewed.json()) as FollowupTask;
  assert.equal(task.status, 'independently_reviewed');
  const detail = await taskDetail(task);
  assert.equal(detail.history.length, 5);
  for (const event of detail.history) {
    const { eventHash, ...content } = event;
    assert.equal(eventHash, followupDigest(content));
  }
  assert.equal(detail.history[0]!.previousHash, detail.history[1]!.eventHash);
  assert.equal(
    (await admin.query('SELECT count(*)::int AS total FROM workspace.outbox')).rows[0].total,
    before,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT data->>'deletionStatus' AS status FROM workspace.consent_receipts WHERE id=$1",
        [receipt.id],
      )
    ).rows[0].status,
    'not-performed',
  );
  assert.ok(
    tasks.filter((t) => t.id !== task.id).every((t) => ['pending', 'unknown'].includes(t.status)),
  );
});
test('self-verification, missing evidence, unsafe reference schemes and invented outcome metadata reject', async () => {
  const { tasks } = await batch();
  let task = tasks.find((t) => t.location.kind === 'digital')!;
  assert.equal((await act(task, 'record_request', { evidenceRefs: [] })).status, 400);
  for (const reference of [
    'https://example.test/proof',
    'file:///etc/passwd',
    '/tmp/proof',
    'sample-evidence:../../secret',
    'sample-evidence:bad label',
  ])
    assert.equal((await act(task, 'declare_complete', { evidenceRefs: [reference] })).status, 400);
  for (const extra of [
    { verified: true },
    { legalReviewStatus: 'approved' },
    { syntheticOnlyAcknowledged: false },
    { note: ' ' },
    { version: 0 },
    { assigneeId: null },
  ])
    assert.equal((await act(task, 'declare_complete', extra)).status, 400);
  task = (await (await act(task, 'declare_complete')).json()) as FollowupTask;
  assert.equal(
    (await act(task, 'verify', { evidenceRefs: ['sample-evidence:another'] })).status,
    403,
  );
});
test('unknown locations cannot be marked done; blocked retry retains unknown; retention exception is unreviewed and owner-controlled', async () => {
  const { tasks } = await batch();
  let unknown = tasks.find((t) => t.location.kind === 'unmapped')!;
  for (const action of ['record_request', 'declare_complete', 'verify', 'retain'])
    assert.equal((await act(unknown, action)).status, 409);
  unknown = (await (await act(unknown, 'block', { evidenceRefs: [] })).json()) as FollowupTask;
  assert.equal(unknown.status, 'blocked');
  unknown = (await (await act(unknown, 'retry', { evidenceRefs: [] })).json()) as FollowupTask;
  assert.equal(unknown.status, 'unknown');
  let known = tasks.find((t) => t.location.kind === 'paper')!;
  known = (await (
    await act(known, 'retain', { note: 'Synthetic retention exception requires review.' })
  ).json()) as FollowupTask;
  assert.equal(known.status, 'retention_exception_declared');
  known = (await (await act(known, 'retry', { evidenceRefs: [] })).json()) as FollowupTask;
  assert.equal(known.status, 'pending');
  assert.equal((await taskDetail(known)).history[1]!.task.status, 'retention_exception_declared');
});
test('assignment restricts staff task visibility/actions; viewers/platform/cross-tenant/branch and inactive membership cannot mutate', async () => {
  const { tasks } = await batch();
  let task = tasks[0]!;
  assert.equal((await request(`followups/${task.id}`, 'GET', undefined, 'staff')).status, 404);
  assert.equal((await request('followups', 'GET', undefined, 'anonymous')).status, 401);
  assert.equal((await act(task, 'block', {}, 'viewer')).status, 403);
  assert.equal((await act(task, 'block', {}, 'operator')).status, 403);
  assert.equal(
    (await request(`followups/${task.id}`, 'GET', undefined, 'other', '', otherTenant)).status,
    404,
  );
  for (const assigneeId of [
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
  ])
    assert.equal((await act(task, 'assign', { assigneeId })).status, 409);
  task = (await (
    await act(task, 'assign', { assigneeId: '00000000-0000-4000-8000-000000000002' })
  ).json()) as FollowupTask;
  assert.equal((await request(`followups/${task.id}`, 'GET', undefined, 'staff')).status, 200);
  const alternate = randomUUID();
  await admin.query('INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3)', [
    tenant,
    alternate,
    'Synthetic branch',
  ]);
  try {
    await admin.query(
      'UPDATE identity.memberships SET branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
      [alternate, tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal((await act(task, 'block', {}, 'staff')).status, 404);
    await admin.query(
      'UPDATE identity.memberships SET active=false WHERE tenant_id=$1 AND user_id=$2',
      [tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal((await act(task, 'block', {}, 'staff')).status, 403);
  } finally {
    await admin.query(
      'UPDATE identity.memberships SET active=true,branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
      [branch, tenant, '00000000-0000-4000-8000-000000000002'],
    );
    await admin.query('DELETE FROM workspace.branches WHERE id=$1', [alternate]);
  }
  assert.equal((await request(`followups/${task.id}`, 'GET', undefined, 'viewer')).status, 200);
  for (const context of [null, otherTenant])
    assert.equal(
      (
        await db.transaction(context, (client) =>
          client.query('SELECT id FROM workspace.followup_tasks WHERE id=$1', [task.id]),
        )
      ).rows.length,
      0,
    );
});
test('concurrent same-key actions append once, changed payload conflicts, and different commands on one version allow one', async () => {
  const { tasks } = await batch(),
    task = tasks[0]!,
    key = randomUUID();
  commandKeys.push(key);
  const body = {
    version: task.version,
    action: 'block',
    note: 'Synthetic block',
    evidenceRefs: [],
    syntheticOnlyAcknowledged: true,
    idempotencyKey: key,
  };
  const responses = await Promise.all([
    request(`followups/${task.id}/actions`, 'POST', body),
    request(`followups/${task.id}/actions`, 'POST', body),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201],
  );
  assert.equal((await taskDetail(task)).history.length, 2);
  assert.equal(
    (await request(`followups/${task.id}/actions`, 'POST', { ...body, note: 'Different' })).status,
    409,
  );
  const current = await taskDetail(task);
  const raced = await Promise.all([
    act(current, 'retry', { evidenceRefs: [] }),
    act(current, 'block', { evidenceRefs: [] }),
  ]);
  assert.deepEqual(raced.map((r) => r.status).sort(), [201, 409]);
});
test('action history and command failure are atomic and event/command tables are immutable to the app role', async () => {
  const { tasks } = await batch(),
    task = tasks[0]!,
    key = randomUUID();
  commandKeys.push(key);
  await admin.query(
    `CREATE FUNCTION workspace.followup_command_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key='${key}'::uuid THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    'CREATE TRIGGER followup_command_failure BEFORE INSERT ON workspace.followup_commands FOR EACH ROW EXECUTE FUNCTION workspace.followup_command_failure()',
  );
  try {
    assert.equal((await act(task, 'block', { idempotencyKey: key, evidenceRefs: [] })).status, 500);
    const detail = await taskDetail(task);
    assert.equal(detail.version, 1);
    assert.equal(detail.history.length, 1);
  } finally {
    await admin.query('DROP TRIGGER followup_command_failure ON workspace.followup_commands');
    await admin.query('DROP FUNCTION workspace.followup_command_failure()');
  }
  for (const sql of [
    'UPDATE workspace.followup_events SET data=data WHERE task_id=$1',
    'DELETE FROM workspace.followup_events WHERE task_id=$1',
    'UPDATE workspace.followup_commands SET response=response WHERE actor_id=$1',
  ])
    await assert.rejects(
      db.transaction(tenant, (client) => client.query(sql, [task.id])),
      /permission denied/,
    );
});
test('follow-up creation failure rolls back the withdrawal receipt/session as one transaction', async () => {
  const selected = await offer(),
    session = await start(selected);
  assert.equal((await submit(session, payload(selected, ['allow', 'allow']))).status, 201);
  await admin.query(
    `CREATE FUNCTION workspace.followup_creation_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.data->'task'->>'noticeId'='${notice.id}' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    'CREATE TRIGGER followup_creation_failure BEFORE INSERT ON workspace.followup_events FOR EACH ROW EXECUTE FUNCTION workspace.followup_creation_failure()',
  );
  const body = {
    version: 1,
    purposeIds: [purposes[0]!.id],
    interfaceLanguage: 'en',
    idempotencyKey: randomUUID(),
  };
  try {
    assert.equal(
      (
        await request(
          `consent-sandbox/sessions/${session.participant.id}/withdraw`,
          'POST',
          body,
          'owner',
          session.cookie,
        )
      ).status,
      500,
    );
    assert.equal(
      (
        await admin.query('SELECT version FROM workspace.consent_participants WHERE id=$1', [
          session.participant.id,
        ])
      ).rows[0].version,
      1,
    );
    assert.equal(
      (
        await admin.query('SELECT id FROM workspace.consent_receipts WHERE session_id=$1', [
          session.participant.id,
        ])
      ).rowCount,
      1,
    );
  } finally {
    await admin.query('DROP TRIGGER followup_creation_failure ON workspace.followup_events');
    await admin.query('DROP FUNCTION workspace.followup_creation_failure()');
  }
  assert.equal(
    (
      await request(
        `consent-sandbox/sessions/${session.participant.id}/withdraw`,
        'POST',
        body,
        'owner',
        session.cookie,
      )
    ).status,
    201,
  );
});
test('candidate source remains the saved notice snapshot after later register edits and repeated receipt reconciliation', async () => {
  const { receipt, tasks } = await batch();
  const original = (
    await admin.query('SELECT data FROM workspace.register_entries WHERE id=$1', [entry.id])
  ).rows[0].data;
  try {
    await admin.query(
      "UPDATE workspace.register_entries SET data=jsonb_set(data,'{storageLocation}','\"Changed new store\"'::jsonb) WHERE id=$1",
      [entry.id],
    );
    const response = await reconcile(receipt.id);
    assert.equal(response.status, 201);
    const current = (await response.json()) as FollowupTask[];
    assert.deepEqual(
      current.map((t) => t.location).sort((a, b) => a.key.localeCompare(b.key)),
      tasks.map((t) => t.location).sort((a, b) => a.key.localeCompare(b.key)),
    );
    assert.ok(!JSON.stringify(current).includes('Changed new store'));
  } finally {
    await admin.query('UPDATE workspace.register_entries SET data=$1 WHERE id=$2', [
      original,
      entry.id,
    ]);
  }
});
