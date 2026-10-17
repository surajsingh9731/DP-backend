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
  CheckDetail,
  CheckEvaluation,
  MappingResult,
  TaskEvidenceReview,
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

const checkKeys: string[] = [];
async function checkPost(
  task: FollowupTask,
  operation: 'reviews' | 'evaluations' | 'mapping',
  body: object,
  role = 'owner',
) {
  const idempotencyKey = randomUUID();
  checkKeys.push(idempotencyKey);
  const final = { idempotencyKey, ...body };
  if ('idempotencyKey' in final) checkKeys.push(final.idempotencyKey as string);
  return request(`checks/tasks/${task.id}/${operation}`, 'POST', final, role);
}
function reviewBody(task: FollowupTask, extra: object = {}) {
  return {
    taskVersion: task.version,
    reviewVersion: 0,
    applicability: 'applicable',
    result: 'pass',
    rationale: 'Synthetic owner assessment; not legal approval or external proof.',
    evidenceRefs: ['sample-evidence:manual-review'],
    validForMinutes: 60,
    syntheticOnlyAcknowledged: true,
    ...extra,
  };
}
function mappingBody(task: FollowupTask, extra: object = {}) {
  return {
    taskVersion: task.version,
    kind: 'digital',
    name: 'Synthetic mapped backup',
    detail: 'Synthetic local backup candidate',
    rationale: 'Synthetic mapping review; residual coverage remains unknown.',
    evidenceRefs: ['sample-evidence:mapping'],
    syntheticOnlyAcknowledged: true,
    ...extra,
  };
}
async function evaluate(task: FollowupTask, reviewVersion = 0, extra: object = {}) {
  const response = await checkPost(task, 'evaluations', {
    taskVersion: task.version,
    reviewVersion,
    ...extra,
  });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json() as Promise<CheckEvaluation>;
}
async function checkDetail(task: FollowupTask, role = 'owner') {
  const response = await request(`checks/tasks/${task.id}`, 'GET', undefined, role);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json() as Promise<CheckDetail>;
}

test('locally computed checks link immutable sources/history and distinguish missing manual evidence from pending follow-up', async () => {
  const { tasks } = await batch(),
    task = tasks.find((t) => t.location.kind === 'vendor')!;
  const before = (await admin.query('SELECT count(*)::int AS total FROM workspace.outbox')).rows[0]
    .total;
  assert.equal((await reconcile(task.receiptId)).status, 201);
  const evaluation = await evaluate(task);
  assert.equal(evaluation.checks.length, 6);
  for (const id of ['receipt_link', 'history_integrity', 'location_reference'])
    assert.equal(evaluation.checks.find((c) => c.id === id)?.result, 'pass');
  assert.equal(evaluation.checks.find((c) => c.id === 'manual_assessment')?.result, 'unknown');
  assert.equal(evaluation.checks.find((c) => c.id === 'followup_state')?.result, 'fail');
  assert.equal(
    evaluation.checks.find((c) => c.id === 'manual_assessment')?.provenance,
    'synthetic-manual-reference',
  );
  const { contentHash, ...content } = evaluation;
  assert.equal(contentHash, followupDigest(content));
  assert.equal(
    (await admin.query('SELECT count(*)::int AS total FROM workspace.outbox')).rows[0].total,
    before,
  );
});
test('owner review is immutable, explicit, provenance-labelled and cannot clear the underlying obligation', async () => {
  const { tasks } = await batch(),
    task = tasks.find((t) => t.location.kind === 'vendor')!;
  for (const extra of [
    { rationale: ' ' },
    { evidenceRefs: [] },
    { evidenceRefs: ['https://example.test/proof'] },
    { validForMinutes: 0 },
    { validForMinutes: 1441 },
    { provenance: 'verified-vendor' },
    { applicability: 'not_applicable', result: 'pass' },
  ])
    assert.equal((await checkPost(task, 'reviews', reviewBody(task, extra))).status, 400);
  const response = await checkPost(
    task,
    'reviews',
    reviewBody(task, { applicability: 'not_applicable', result: 'not_applicable' }),
  );
  assert.equal(response.status, 201);
  const review = (await response.json()) as TaskEvidenceReview;
  assert.equal(review.authenticity, 'not-authenticated');
  const evaluation = await evaluate(task, 1);
  assert.equal(
    evaluation.checks.find((c) => c.id === 'applicability_review')?.result,
    'not_applicable',
  );
  assert.equal(evaluation.checks.find((c) => c.id === 'followup_state')?.result, 'fail');
  assert.equal((await taskDetail(task)).status, 'pending');
});
test('expired evidence becomes unknown, old evaluation remains immutable and a new evaluation uses current freshness', async () => {
  const { tasks } = await batch(),
    task = tasks[0]!;
  assert.equal((await checkPost(task, 'reviews', reviewBody(task))).status, 201);
  const first = await evaluate(task, 1);
  await admin.query(
    "UPDATE workspace.check_reviews SET data=jsonb_set(data,'{validUntil}',to_jsonb((now()-interval '1 minute')::text)) WHERE task_id=$1",
    [task.id],
  );
  const detail = await checkDetail(task);
  assert.equal(detail.freshness, 'expired');
  assert.equal(detail.latestEvaluationCurrent, false);
  const next = await evaluate(task, 1);
  assert.equal(next.checks.find((c) => c.id === 'manual_assessment')?.result, 'unknown');
  assert.equal(next.checks.find((c) => c.id === 'manual_assessment')?.freshness, 'expired');
  assert.equal((await checkDetail(task)).latestEvaluationCurrent, true);
  assert.deepEqual(
    (await checkDetail(task)).evaluations.find((e) => e.id === first.id),
    first,
  );
});
test('task changes invalidate owner evidence and reject stale task or review versions', async () => {
  const { tasks } = await batch();
  let task = tasks.find((t) => t.location.kind === 'paper')!;
  assert.equal((await checkPost(task, 'reviews', reviewBody(task))).status, 201);
  await evaluate(task, 1);
  const old = task;
  task = (await (await act(task, 'block', { evidenceRefs: [] })).json()) as FollowupTask;
  const detail = await checkDetail(task);
  assert.equal(detail.freshness, 'task_changed');
  assert.equal(detail.latestEvaluationCurrent, false);
  assert.equal(
    (await checkPost(old, 'evaluations', { taskVersion: old.version, reviewVersion: 1 })).status,
    409,
  );
  assert.equal((await checkPost(task, 'reviews', reviewBody(task))).status, 409);
  assert.equal(
    (await evaluate(task, 1)).checks.find((c) => c.id === 'manual_assessment')?.result,
    'unknown',
  );
});
test('applicability overrides/evaluation access remain role, assignee, branch and tenant scoped with raw RLS', async () => {
  const { tasks } = await batch();
  let task = tasks[0]!;
  for (const role of ['staff', 'viewer', 'operator'])
    assert.equal((await checkPost(task, 'reviews', reviewBody(task), role)).status, 403);
  assert.equal((await checkPost(task, 'mapping', mappingBody(task), 'staff')).status, 403);
  assert.equal(
    (await checkPost(task, 'evaluations', { taskVersion: 1, reviewVersion: 0 }, 'viewer')).status,
    403,
  );
  assert.equal(
    (await request(`checks/tasks/${task.id}`, 'GET', undefined, 'other', '', otherTenant)).status,
    404,
  );
  assert.equal((await request(`checks/tasks/${task.id}`, 'GET', undefined, 'staff')).status, 404);
  task = (await (
    await act(task, 'assign', { assigneeId: '00000000-0000-4000-8000-000000000002' })
  ).json()) as FollowupTask;
  assert.equal((await request(`checks/tasks/${task.id}`, 'GET', undefined, 'staff')).status, 200);
  assert.equal(
    (await checkPost(task, 'evaluations', { taskVersion: task.version, reviewVersion: 0 }, 'staff'))
      .status,
    201,
  );
  await evaluate(task);
  const alternate = randomUUID();
  await admin.query('INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3)', [
    tenant,
    alternate,
    'Synthetic checks branch',
  ]);
  try {
    await admin.query(
      'UPDATE identity.memberships SET branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
      [alternate, tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal((await request(`checks/tasks/${task.id}`, 'GET', undefined, 'staff')).status, 404);
    await admin.query(
      'UPDATE identity.memberships SET active=false WHERE tenant_id=$1 AND user_id=$2',
      [tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal((await request(`checks/tasks/${task.id}`, 'GET', undefined, 'staff')).status, 403);
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
          client.query('SELECT id FROM workspace.check_evaluations WHERE task_id=$1', [task.id]),
        )
      ).rows.length,
      0,
    );
});
test('concurrent mapping retries create one pending child and keep residual unknown coverage and prior history', async () => {
  const { tasks, receipt } = await batch(),
    parent = tasks.find((t) => t.location.kind === 'unmapped')!,
    idempotencyKey = randomUUID(),
    body = mappingBody(parent, { idempotencyKey });
  const responses = await Promise.all([
    checkPost(parent, 'mapping', body),
    checkPost(parent, 'mapping', body),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201],
  );
  const [first, second] = await Promise.all(
    responses.map((r) => r.json() as Promise<MappingResult>),
  );
  assert.equal(first!.child!.id, second!.child!.id);
  assert.equal(first!.child!.status, 'pending');
  assert.equal(first!.parent.location.mapping, 'unknown');
  assert.equal(first!.parent.status, 'unknown');
  assert.deepEqual(first!.parent.mappedTaskIds, [first!.child!.id]);
  assert.equal(first!.child!.receiptHash, receipt.receiptHash);
  assert.equal(first!.child!.parentMappingTaskId, parent.id);
  const history = await taskDetail(first!.parent);
  assert.equal(history.history[0]!.action, 'mapping_added');
  assert.equal(history.history[1]!.task.version, 1);
  assert.equal(
    (await checkPost(parent, 'mapping', mappingBody(parent, { name: 'Different' }))).status,
    409,
  );
  assert.equal((await checkPost(first!.parent, 'mapping', mappingBody(first!.parent))).status, 409);
  assert.equal(
    (
      await checkPost(
        first!.parent,
        'reviews',
        reviewBody(first!.parent, { applicability: 'not_applicable', result: 'not_applicable' }),
      )
    ).status,
    409,
  );
});
test('specific paper mapping resolves only that place and preserves a pending withdrawal obligation and original source', async () => {
  const original = (
    await admin.query('SELECT register_data FROM workspace.notice_snapshots WHERE id=$1', [
      notice.id,
    ])
  ).rows[0].register_data;
  let created: Awaited<ReturnType<typeof batch>>;
  try {
    const altered = {
      ...original,
      hasPaperRecords: true,
      storageReferences: original.storageReferences.filter(
        (row: { medium: string }) => row.medium !== 'paper',
      ),
    };
    await admin.query('UPDATE workspace.notice_snapshots SET register_data=$1 WHERE id=$2', [
      altered,
      notice.id,
    ]);
    created = await batch();
  } finally {
    await admin.query('UPDATE workspace.notice_snapshots SET register_data=$1 WHERE id=$2', [
      original,
      notice.id,
    ]);
  }
  const parent = created.tasks.find(
    (t) => t.location.kind === 'unmapped' && t.location.name === 'paper',
  )!;
  assert.ok(parent);
  assert.equal((await checkPost(parent, 'mapping', mappingBody(parent))).status, 409);
  const response = await checkPost(
    parent,
    'mapping',
    mappingBody(parent, {
      kind: 'paper',
      name: 'Synthetic archive cupboard',
      detail: 'Sample paper shelf',
    }),
  );
  assert.equal(response.status, 201, await response.clone().text());
  const mapped = (await response.json()) as MappingResult;
  assert.equal(mapped.child, null);
  assert.equal(mapped.parent.id, parent.id);
  assert.equal(mapped.parent.status, 'pending');
  assert.equal(mapped.parent.location.kind, 'paper');
  assert.deepEqual(mapped.parent.mappingResolution?.originalLocation, parent.location);
  assert.equal((await taskDetail(parent)).history[0]!.action, 'mapping_resolved');
  assert.equal(
    (await evaluate(mapped.parent)).checks.find((c) => c.id === 'history_integrity')?.result,
    'pass',
  );
  assert.equal(
    (
      await admin.query('SELECT location_key FROM workspace.followup_tasks WHERE id=$1', [
        parent.id,
      ])
    ).rows[0].location_key,
    mapped.parent.location.key,
  );
});
test('different mapping commands on the same version accept one decision and never lose an obligation', async () => {
  const { tasks } = await batch(),
    parent = tasks.find((t) => t.location.kind === 'unmapped')!;
  const responses = await Promise.all([
    checkPost(parent, 'mapping', mappingBody(parent, { name: 'Synthetic A' })),
    checkPost(parent, 'mapping', mappingBody(parent, { name: 'Synthetic B' })),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const current = await taskDetail(parent);
  assert.equal(current.mappedTaskIds?.length, 1);
  assert.equal(current.status, 'unknown');
});
test('mapping command failure rolls back parent version, child task and both audit histories atomically', async () => {
  const { tasks } = await batch(),
    parent = tasks.find((t) => t.location.kind === 'unmapped')!,
    key = randomUUID();
  checkKeys.push(key);
  const before = (
    await admin.query(
      'SELECT count(*)::int AS total FROM workspace.followup_tasks WHERE receipt_id=$1',
      [parent.receiptId],
    )
  ).rows[0].total;
  await admin.query(
    `CREATE FUNCTION workspace.check_mapping_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key='${key}'::uuid THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    'CREATE TRIGGER check_mapping_failure BEFORE INSERT ON workspace.check_commands FOR EACH ROW EXECUTE FUNCTION workspace.check_mapping_failure()',
  );
  try {
    assert.equal(
      (await checkPost(parent, 'mapping', mappingBody(parent, { idempotencyKey: key }))).status,
      500,
    );
    assert.equal((await taskDetail(parent)).version, 1);
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int AS total FROM workspace.followup_tasks WHERE receipt_id=$1',
          [parent.receiptId],
        )
      ).rows[0].total,
      before,
    );
  } finally {
    await admin.query('DROP TRIGGER check_mapping_failure ON workspace.check_commands');
    await admin.query('DROP FUNCTION workspace.check_mapping_failure()');
  }
  assert.equal(
    (await checkPost(parent, 'mapping', mappingBody(parent, { idempotencyKey: key }))).status,
    201,
  );
});
test('computed history check detects a task snapshot mismatch rather than trusting a manual claim', async () => {
  const { tasks } = await batch(),
    task = tasks[0]!,
    original = (
      await admin.query('SELECT data FROM workspace.followup_tasks WHERE id=$1', [task.id])
    ).rows[0].data;
  try {
    await admin.query(
      "UPDATE workspace.followup_tasks SET data=jsonb_set(data,'{status}','\"blocked\"'::jsonb) WHERE id=$1",
      [task.id],
    );
    assert.equal(
      (await evaluate(task)).checks.find((c) => c.id === 'history_integrity')?.result,
      'fail',
    );
  } finally {
    await admin.query('UPDATE workspace.followup_tasks SET data=$1 WHERE id=$2', [
      original,
      task.id,
    ]);
  }
});
test('evaluation retries append once, new explicit evaluations repeat safely and changed command payload conflicts', async () => {
  const { tasks } = await batch(),
    task = tasks[0]!,
    idempotencyKey = randomUUID(),
    body = { taskVersion: task.version, reviewVersion: 0, idempotencyKey };
  const responses = await Promise.all([
    checkPost(task, 'evaluations', body),
    checkPost(task, 'evaluations', body),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201],
  );
  const values = await Promise.all(responses.map((r) => r.json() as Promise<CheckEvaluation>));
  assert.equal(values[0]!.id, values[1]!.id);
  assert.equal((await checkDetail(task)).evaluations.length, 1);
  await evaluate(task);
  assert.equal((await checkDetail(task)).evaluations.length, 2);
  assert.equal((await checkPost(task, 'evaluations', { ...body, reviewVersion: 1 })).status, 409);
});
test('owner review retries append once and review/evaluation/command histories cannot be rewritten by the application role', async () => {
  const { tasks } = await batch(),
    task = tasks[0]!,
    idempotencyKey = randomUUID(),
    body = reviewBody(task, { idempotencyKey });
  const responses = await Promise.all([
    checkPost(task, 'reviews', body),
    checkPost(task, 'reviews', body),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201],
  );
  assert.equal((await checkDetail(task)).reviews.length, 1);
  assert.equal(
    (await checkPost(task, 'reviews', reviewBody(task, { idempotencyKey, rationale: 'Different' })))
      .status,
    409,
  );
  await evaluate(task, 1);
  for (const sql of [
    'UPDATE workspace.check_reviews SET data=data WHERE task_id=$1',
    'DELETE FROM workspace.check_evaluations WHERE task_id=$1',
    'UPDATE workspace.check_commands SET response=response WHERE actor_id=$1',
  ])
    await assert.rejects(
      db.transaction(tenant, (client) => client.query(sql, [task.id])),
      /permission denied/,
    );
});
