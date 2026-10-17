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
  EvidencePage,
  EvidenceDetail,
  FollowupTask,
  CheckEvaluation,
  RightsRequest,
  RightsDetail,
  ParticipantRightsRequest,
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
    await admin.query(
      'DELETE FROM workspace.rights_commands WHERE idempotency_key=ANY($1::uuid[])',
      [rightsKeys],
    );
    const rightsFilter =
      'session_id IN (SELECT id FROM workspace.consent_participants WHERE offer_id IN (SELECT id FROM workspace.consent_offers WHERE notice_id=$1))';
    await admin.query(
      `DELETE FROM workspace.rights_events WHERE request_id IN (SELECT id FROM workspace.rights_requests WHERE ${rightsFilter})`,
      [notice.id],
    );
    await admin.query(`DELETE FROM workspace.rights_requests WHERE ${rightsFilter}`, [notice.id]);

    await admin.query(
      'DELETE FROM workspace.check_commands WHERE idempotency_key=ANY($1::uuid[])',
      [checkKeys],
    );
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

const checkKeys: string[] = [],
  commandKeys: string[] = [],
  rightsKeys: string[] = [];
function intake(extra: object = {}) {
  const idempotencyKey = randomUUID();
  rightsKeys.push(idempotencyKey);
  return {
    kind: 'access',
    inputLanguage: 'hi',
    details: 'Synthetic request instruction only.',
    syntheticOnlyAcknowledged: true,
    idempotencyKey,
    ...extra,
  };
}
async function create(session: Awaited<ReturnType<typeof start>>, body: object = intake()) {
  return request(
    `consent-sandbox/sessions/${session.participant.id}/requests`,
    'POST',
    body,
    session.role,
    session.cookie,
  );
}
async function fresh(kind = 'access') {
  const session = await start(await offer());
  const response = await create(
    session,
    intake({
      kind,
      ...(kind === 'correction'
        ? {
            correction: {
              fieldReference: 'Synthetic field',
              requestedValue: 'Synthetic amended value',
            },
          }
        : {}),
    }),
  );
  assert.equal(response.status, 201, await response.clone().text());
  const publicRow = (await response.json()) as ParticipantRightsRequest;
  return { session, publicRow, row: await detail(publicRow.id) };
}
async function detail(id: string, role = 'owner') {
  const response = await request(`rights/${id}`, 'GET', undefined, role);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json() as Promise<RightsDetail>;
}
async function action(row: RightsRequest, action: string, extra: object = {}, role = 'owner') {
  const idempotencyKey = randomUUID();
  rightsKeys.push(idempotencyKey);
  return request(
    `rights/${row.id}/actions`,
    'POST',
    {
      version: row.version,
      action,
      note: 'Private synthetic triage note',
      evidenceRefs: ['sample-evidence:declaration'],
      syntheticOnlyAcknowledged: true,
      idempotencyKey,
      ...extra,
    },
    role,
  );
}
async function next(row: RightsRequest, act: string, extra: object = {}, role = 'owner') {
  const response = await action(row, act, extra, role);
  assert.equal(response.status, 201, await response.clone().text());
  return response.json() as Promise<RightsRequest>;
}

test('evidence list exposes only bounded metadata and all supported permitted source families', async () => {
  const created = await fresh('erasure');
  await next(created.row, 'begin_review');
  const response = await request('evidence?limit=2');
  assert.equal(response.status, 200, await response.clone().text());
  const page = (await response.json()) as {
    items: { kind: string; key: string }[];
    nextCursor: string | null;
  };
  assert.equal(page.items.length, 2);
  assert.ok(page.nextCursor);
  assert.equal(new Set(page.items.map((i) => i.key)).size, 2);
  assert.ok(!JSON.stringify(page).includes('Synthetic request instruction'));
  assert.ok(!JSON.stringify(page).includes('Private internal vendor'));
});
test('evidence excludes unauthorized staff requests from list/search and detail', async () => {
  const { row } = await fresh();
  const denied = await request(`evidence/rights/${row.id}/1`, 'GET', undefined, 'staff');
  assert.equal(denied.status, 404);
  const result = await request(`evidence?kind=rights&q=${row.id}`, 'GET', undefined, 'staff');
  assert.equal(result.status, 200);
  assert.deepEqual(((await result.json()) as { items: unknown[] }).items, []);
  assert.equal((await request('evidence', 'GET', undefined, 'viewer')).status, 403);
});

async function hub(query = '', role = 'owner', selectedTenant = tenant) {
  const response = await request(
    `evidence${query ? '?' + query : ''}`,
    'GET',
    undefined,
    role,
    '',
    selectedTenant,
  );
  assert.equal(response.status, 200, await response.clone().text());
  return response.json() as Promise<EvidencePage>;
}
async function event(kind: string, id: string, version = 1, role = 'owner') {
  const response = await request(`evidence/${kind}/${id}/${version}`, 'GET', undefined, role);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json() as Promise<EvidenceDetail>;
}
async function withdrawal(role = 'owner') {
  const selected = await offer(),
    session = await start(selected, role);
  assert.equal((await submit(session, payload(selected, ['allow', 'allow']))).status, 201);
  const response = await request(
    `consent-sandbox/sessions/${session.participant.id}/withdraw`,
    'POST',
    {
      version: 1,
      purposeIds: [purposes[0]!.id],
      interfaceLanguage: 'hi',
      idempotencyKey: randomUUID(),
    },
    role,
    session.cookie,
  );
  assert.equal(response.status, 201);
  const receipt = (await response.json()) as ConsentReceipt;
  const tasks = (
    await admin.query('SELECT data FROM workspace.followup_tasks WHERE receipt_id=$1', [receipt.id])
  ).rows.map((r) => r.data as FollowupTask);
  return { session, receipt, tasks };
}
async function taskAction(task: FollowupTask, action: string, extra: object = {}) {
  const key = randomUUID();
  commandKeys.push(key);
  const response = await request(`followups/${task.id}/actions`, 'POST', {
    version: task.version,
    action,
    note: 'Private synthetic task note',
    evidenceRefs: [],
    syntheticOnlyAcknowledged: true,
    idempotencyKey: key,
    ...extra,
  });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json() as Promise<FollowupTask>;
}
async function evaluate(task: FollowupTask) {
  const key = randomUUID();
  checkKeys.push(key);
  const response = await request(`checks/tasks/${task.id}/evaluations`, 'POST', {
    taskVersion: task.version,
    reviewVersion: 0,
    idempotencyKey: key,
  });
  assert.equal(response.status, 201);
  return response.json() as Promise<CheckEvaluation>;
}
test('pagination drains all eight source families without duplicates and filters are applied before limits', async () => {
  const { tasks } = await withdrawal();
  const task = tasks.find((t) => t.location.mapping === 'declared')!,
    evaluation = await evaluate(task);
  const key = randomUUID();
  checkKeys.push(key);
  assert.equal(
    (
      await request(`checks/tasks/${task.id}/reviews`, 'POST', {
        taskVersion: task.version,
        reviewVersion: 0,
        applicability: 'applicable',
        result: 'pass',
        rationale: 'Private synthetic review rationale',
        evidenceRefs: ['sample-evidence:hub-fixture'],
        validForMinutes: 60,
        syntheticOnlyAcknowledged: true,
        idempotencyKey: key,
      })
    ).status,
    201,
  );
  const keys: string[] = [],
    kinds = new Set<string>();
  let cursor: string | null = null,
    asOf: string | undefined;
  for (let page = 0; page < 40; page++) {
    const result = await hub('limit=3' + (cursor ? '&cursor=' + cursor : ''));
    assert.equal(result.items.length <= 3, true);
    if (asOf) assert.equal(result.asOf, asOf);
    asOf = result.asOf;
    for (const item of result.items) {
      assert.ok(!keys.includes(item.key));
      keys.push(item.key);
      kinds.add(item.kind);
      assert.equal((await event(item.kind, item.id, item.version)).item.key, item.key);
    }
    cursor = result.nextCursor;
    if (!cursor) break;
    if (page === 39) assert.fail('pagination did not finish');
  }
  assert.deepEqual([...kinds].sort(), [
    'check_evaluation',
    'check_review',
    'consent',
    'followup',
    'notice',
    'notice_decision',
    'rights',
    'withdrawal',
  ]);
  assert.equal(
    (await hub(`kind=check_evaluation&q=${evaluation.id}&provenance=computed&limit=1`)).items[0]!
      .id,
    evaluation.id,
  );
  assert.deepEqual((await hub(`kind=check_evaluation&provenance=manual`)).items, []);
  assert.deepEqual((await hub('q=Private%20synthetic')).items, []);
  assert.deepEqual((await hub('q=%25')).items, []);
});
test('filter/cursor validation rejects malformed and mismatched pages without exporting totals or query text', async () => {
  const page = await hub('limit=1');
  assert.ok(page.nextCursor);
  for (const query of [
    'limit=0',
    'limit=51',
    'limit=1.5',
    'kind=all',
    'provenance=verified',
    'q=' + 'a'.repeat(81),
    'unknown=true',
    'cursor=bad-json',
    'limit=1&q=changed&cursor=' + page.nextCursor,
    'limit=2&cursor=' + page.nextCursor,
  ])
    assert.equal((await request('evidence?' + query)).status, 400, query);
  const staff = await request(
    'evidence?limit=1&cursor=' + page.nextCursor,
    'GET',
    undefined,
    'staff',
  );
  assert.equal(staff.status, 400);
  assert.ok(!('total' in page));
  assert.ok(!('q' in page));
  for (const path of [
    'bad/' + randomUUID() + '/1',
    'rights/not-a-uuid/1',
    'rights/' + randomUUID() + '/0',
    'rights/' + randomUUID() + '/1.2',
  ])
    assert.equal((await request('evidence/' + path)).status, 400);
});
test('consent and withdrawal evidence is owner-or-creating-actor scoped, never broadened by a different participant cookie', async () => {
  const owner = await withdrawal(),
    staff = await withdrawal('staff');
  const ownPage = await hub(`kind=withdrawal&q=${staff.receipt.id}`, 'staff');
  assert.equal(ownPage.items.length, 1);
  assert.equal(
    (await event('withdrawal', staff.receipt.id, 2, 'staff')).integrity.digest,
    'not_checked',
  );
  assert.deepEqual((await hub(`kind=withdrawal&q=${owner.receipt.id}`, 'staff')).items, []);
  for (const kind of ['consent', 'withdrawal']) {
    const id =
      kind === 'withdrawal'
        ? owner.receipt.id
        : (
            await admin.query(
              'SELECT id FROM workspace.consent_receipts WHERE session_id=$1 AND version=1',
              [owner.session.participant.id],
            )
          ).rows[0].id;
    assert.equal(
      (
        await request(
          `evidence/${kind}/${id}/${kind === 'withdrawal' ? 2 : 1}`,
          'GET',
          undefined,
          'staff',
          owner.session.cookie,
        )
      ).status,
      404,
    );
  }
  assert.equal(
    (
      await request(
        `evidence/withdrawal/${owner.receipt.id}/2`,
        'GET',
        undefined,
        'other',
        '',
        otherTenant,
      )
    ).status,
    404,
  );
});
test('assignment changes remove event/check/rights visibility from both queries and detail without revealing related receipt', async () => {
  const created = await withdrawal();
  let task = created.tasks[0]!;
  const evaluation = await evaluate(task);
  assert.deepEqual((await hub(`kind=followup&q=${task.id}`, 'staff')).items, []);
  assert.equal(
    (await request(`evidence/check_evaluation/${evaluation.id}/1`, 'GET', undefined, 'staff'))
      .status,
    404,
  );
  task = await taskAction(task, 'assign', { assigneeId: '00000000-0000-4000-8000-000000000002' });
  assert.ok((await hub(`kind=followup&q=${task.id}`, 'staff')).items.length);
  const detail = await event('followup', task.id, task.version, 'staff');
  assert.equal(detail.links.find((l) => l.label === 'withdrawal')?.state, 'unavailable');
  assert.ok(!JSON.stringify(detail).includes(created.receipt.id));
  assert.equal((await event('check_evaluation', evaluation.id, 1, 'staff')).item.id, evaluation.id);
  task = await taskAction(task, 'assign', { assigneeId: null });
  assert.deepEqual((await hub(`kind=followup&q=${task.id}`, 'staff')).items, []);
  assert.equal(
    (await request(`evidence/followup/${task.id}/1`, 'GET', undefined, 'staff')).status,
    404,
  );
  let row: RightsRequest = (await fresh()).row;
  row = await next(row, 'assign', { assigneeId: '00000000-0000-4000-8000-000000000002' });
  assert.equal((await event('rights', row.id, 1, 'staff')).item.id, row.id);
  row = await next(row, 'assign', { assigneeId: null });
  assert.deepEqual((await hub(`kind=rights&q=${row.id}`, 'staff')).items, []);
  assert.equal(
    (await request(`evidence/rights/${row.id}/1`, 'GET', undefined, 'staff')).status,
    404,
  );
});
test('branch/membership revalidation prevents list/detail and no-context raw tenant reads remain isolated', async () => {
  const created = await fresh();
  const row: RightsRequest = await next(created.row, 'assign', {
    assigneeId: '00000000-0000-4000-8000-000000000002',
  });
  const alternate = randomUUID();
  await admin.query('INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3)', [
    tenant,
    alternate,
    'Synthetic evidence branch',
  ]);
  try {
    await admin.query(
      'UPDATE identity.memberships SET branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
      [alternate, tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.deepEqual((await hub(`kind=rights&q=${row.id}`, 'staff')).items, []);
    assert.equal(
      (await request(`evidence/rights/${row.id}/1`, 'GET', undefined, 'staff')).status,
      404,
    );
    await admin.query(
      'UPDATE identity.memberships SET active=false WHERE tenant_id=$1 AND user_id=$2',
      [tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal((await request('evidence', 'GET', undefined, 'staff')).status, 403);
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
        await db.transaction(context, (client) =>
          client.query('SELECT request_id FROM workspace.rights_events WHERE request_id=$1', [
            row.id,
          ]),
        )
      ).rows.length,
      0,
    );
});
test('single-event digest and previous-link checks distinguish mismatches and missing sources without claiming full-chain verification', async () => {
  let row: RightsRequest = (await fresh()).row;
  row = await next(row, 'begin_review');
  const good = await event('rights', row.id, 2);
  assert.equal(good.integrity.digest, 'match');
  assert.equal(good.integrity.previous, 'linked');
  assert.equal(good.integrity.scope, 'single-event-and-previous-reference');
  const original = (
    await admin.query(
      'SELECT data FROM workspace.rights_events WHERE request_id=$1 AND version=2',
      [row.id],
    )
  ).rows[0].data;
  try {
    const altered = {
      ...original,
      note: 'Synthetic privileged mismatch fixture',
      previousHash: '0'.repeat(64),
      request: {
        ...original.request,
        source: { ...original.request.source, noticeId: randomUUID() },
      },
    };
    await admin.query(
      'UPDATE workspace.rights_events SET data=$1 WHERE request_id=$2 AND version=2',
      [altered, row.id],
    );
    const broken = await event('rights', row.id, 2);
    assert.equal(broken.integrity.digest, 'mismatch');
    assert.equal(broken.integrity.previous, 'mismatch');
    assert.deepEqual(
      broken.links.find((l) => l.label === 'notice'),
      { label: 'notice', state: 'unavailable' },
    );
    assert.ok(!JSON.stringify(broken).includes(altered.request.source.noticeId));
  } finally {
    await admin.query(
      'UPDATE workspace.rights_events SET data=$1 WHERE request_id=$2 AND version=2',
      [original, row.id],
    );
  }
  const prior = (
    await admin.query(
      'SELECT data FROM workspace.rights_events WHERE request_id=$1 AND version=1',
      [row.id],
    )
  ).rows[0].data;
  await admin.query('DELETE FROM workspace.rights_events WHERE request_id=$1 AND version=1', [
    row.id,
  ]);
  try {
    assert.equal((await event('rights', row.id, 2)).integrity.previous, 'unavailable');
  } finally {
    await admin.query(
      'INSERT INTO workspace.rights_events(tenant_id,request_id,version,data) VALUES($1,$2,1,$3)',
      [tenant, row.id, prior],
    );
  }
});
test('computed snapshot integrity stays separate from changed/expired manual evidence and source-state freshness', async () => {
  const { tasks } = await withdrawal();
  let task = tasks.find((t) => t.location.mapping === 'declared')!;
  const evaluation = await evaluate(task);
  const detail = await event('check_evaluation', evaluation.id);
  assert.equal(detail.integrity.digest, 'match');
  assert.equal(detail.freshness, 'missing');
  task = await taskAction(task, 'block');
  assert.equal((await event('check_evaluation', evaluation.id)).freshness, 'task_changed');
  const key = randomUUID();
  checkKeys.push(key);
  const response = await request(`checks/tasks/${task.id}/reviews`, 'POST', {
    taskVersion: task.version,
    reviewVersion: 0,
    applicability: 'applicable',
    result: 'pass',
    rationale: 'Synthetic review only',
    evidenceRefs: ['sample-evidence:expiry'],
    validForMinutes: 1,
    syntheticOnlyAcknowledged: true,
    idempotencyKey: key,
  });
  assert.equal(response.status, 201);
  assert.equal((await event('check_review', task.id, 1)).freshness, 'current');
  const original = (
    await admin.query('SELECT data FROM workspace.check_reviews WHERE task_id=$1 AND version=1', [
      task.id,
    ])
  ).rows[0].data;
  try {
    await admin.query(
      "UPDATE workspace.check_reviews SET data=jsonb_set(data,'{validUntil}',to_jsonb((now()-interval '1 minute')::text)) WHERE task_id=$1",
      [task.id],
    );
    assert.equal((await event('check_review', task.id, 1)).freshness, 'expired');
  } finally {
    await admin.query('UPDATE workspace.check_reviews SET data=$1 WHERE task_id=$2', [
      original,
      task.id,
    ]);
  }
});
test('hub is read-only and excludes internal instructions, evidence references and actor/security fields from every detail', async () => {
  const before = (await admin.query('SELECT count(*)::int AS n FROM workspace.outbox')).rows[0].n;
  const page = await hub('limit=50');
  for (const item of page.items) {
    const detail = await event(item.kind, item.id, item.version),
      text = JSON.stringify(detail);
    for (const token of [
      'Private synthetic',
      'Private internal vendor',
      'sample-evidence:',
      'actorId',
      'declaredBy',
      'tokenHash',
      'requestedValue',
      'rationale',
      'email',
      'contentHash',
    ])
      assert.ok(!text.includes(token), token);
    assert.equal(
      (await request(`evidence/${item.kind}/${item.id}/${item.version}`, 'POST', {})).status,
      404,
    );
  }
  assert.equal(
    (await admin.query('SELECT count(*)::int AS n FROM workspace.outbox')).rows[0].n,
    before,
  );
  assert.equal(
    (await admin.query('SELECT version FROM workspace.register_entries WHERE id=$1', [entry.id]))
      .rows[0].version,
    entry.version,
  );
});

test('millisecond-normalized keyset paging keeps equal-time events and PostgreSQL microseconds without omission', async () => {
  const rows = [await fresh(), await fresh(), await fresh()];
  const ids = rows.map((r) => r.row.id);
  const originals = (
    await admin.query(
      'SELECT request_id,data FROM workspace.rights_events WHERE request_id=ANY($1::uuid[])',
      [ids],
    )
  ).rows;
  try {
    for (const [index, row] of originals.entries())
      await admin.query(
        "UPDATE workspace.rights_events SET data=jsonb_set(data,'{at}',to_jsonb($1::text)) WHERE request_id=$2",
        [`2026-10-17T00:00:00.123${111 + index}Z`, row.request_id],
      );
    const collected: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 100; page++) {
      const result = await hub('kind=rights&limit=1' + (cursor ? '&cursor=' + cursor : ''));
      collected.push(...result.items.filter((i) => ids.includes(i.id)).map((i) => i.id));
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    assert.deepEqual([...collected].sort(), [...ids].sort());
  } finally {
    for (const row of originals)
      await admin.query('UPDATE workspace.rights_events SET data=$1 WHERE request_id=$2', [
        row.data,
        row.request_id,
      ]);
  }
});

test('anonymous/participant-only access cannot enter the internal hub and malformed cursor dates fail safely', async () => {
  const created = await fresh();
  assert.equal(
    (await request('evidence', 'GET', undefined, 'anonymous', created.session.cookie)).status,
    401,
  );
  const page = await hub('limit=1');
  const cursor = JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
  for (const values of [
    { asOf: '0000-01-01T00:00:00.000Z', beforeAt: '0000-01-01T00:00:00.000Z' },
    { beforeAt: '2026-02-30T00:00:00.000Z' },
    { asOf: 'not-a-date' },
    { extra: true },
  ]) {
    const encoded = Buffer.from(JSON.stringify({ ...cursor, ...values })).toString('base64url');
    assert.equal((await request('evidence?limit=1&cursor=' + encoded)).status, 400);
  }
  const submitted = await event('rights', created.row.id, 1);
  assert.equal(submitted.item.provenance, 'recorded');
});
