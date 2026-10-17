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
async function own(
  session: Awaited<ReturnType<typeof start>>,
  id?: string,
  cookie = session.cookie,
  role = session.role,
) {
  return request(
    `consent-sandbox/sessions/${session.participant.id}/requests${id ? '/' + id : ''}`,
    'GET',
    undefined,
    role,
    cookie,
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
test('four synthetic rights kinds pin source without requiring consent or changing source/outbox', async () => {
  const before = (await admin.query('SELECT count(*)::int AS n FROM workspace.outbox')).rows[0].n;
  for (const kind of ['access', 'correction', 'erasure', 'grievance']) {
    const { row, publicRow } = await fresh(kind);
    assert.equal(row.kind, kind);
    assert.equal(row.inputLanguage, 'hi');
    assert.equal(row.source.noticeId, notice.id);
    assert.equal(row.source.sourceReceiptId, null);
    assert.equal(row.status, 'requested');
    assert.equal(row.history.length, 1);
    assert.ok(row.workItems.length);
    assert.equal(publicRow.assurance, 'unverified-synthetic-adult');
    assert.equal(
      (
        await admin.query('SELECT version FROM workspace.consent_participants WHERE id=$1', [
          row.sessionId,
        ])
      ).rows[0].version,
      0,
    );
  }
  assert.equal(
    (await admin.query('SELECT version FROM workspace.register_entries WHERE id=$1', [entry.id]))
      .rows[0].version,
    entry.version,
  );
  assert.equal(
    (await admin.query('SELECT count(*)::int AS n FROM workspace.outbox')).rows[0].n,
    before,
  );
});
test('intake validates correction fields, acknowledgment, language and rejects forged source or unknown fields', async () => {
  const session = await start(await offer());
  for (const extra of [
    { kind: 'correction' },
    { kind: 'erasure', correction: { fieldReference: 'Synthetic', requestedValue: 'Value' } },
    { kind: 'correction', correction: { fieldReference: ' ', requestedValue: 'Value' } },
    { syntheticOnlyAcknowledged: false },
    { inputLanguage: 'xx' },
    { details: ' ' },
    { source: { noticeId: randomUUID() } },
    { kind: 'export' },
    { details: 'a'.repeat(2001) },
  ])
    assert.equal((await create(session, intake(extra))).status, 400);
});
test('participant cookie, actor, session, expiry and tenant isolation hold independently of workspace access', async () => {
  const a = await fresh(),
    b = await fresh();
  assert.equal((await own(a.session, a.row.id, '')).status, 403);
  assert.equal((await own(a.session, a.row.id, b.session.cookie)).status, 403);
  assert.equal((await own(a.session, a.row.id, a.session.cookie, 'staff')).status, 403);
  assert.equal((await own(b.session, a.row.id)).status, 404);
  assert.equal(
    (await request(`rights/${a.row.id}`, 'GET', undefined, 'other', '', otherTenant)).status,
    404,
  );
  await admin.query(
    "UPDATE workspace.consent_participants SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [a.row.sessionId],
  );
  assert.equal((await own(a.session)).status, 403);
  assert.equal((await create(a.session)).status, 403);
  await admin.query('UPDATE workspace.consent_participants SET revoked=true WHERE id=$1', [
    b.row.sessionId,
  ]);
  assert.equal((await own(b.session)).status, 403);
});
test('concurrent intake retries create once and replay returns current public status without private projection', async () => {
  const session = await start(await offer()),
    body = intake();
  const responses = await Promise.all([create(session, body), create(session, body)]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201],
  );
  const [a, b] = await Promise.all(
    responses.map((r) => r.json() as Promise<ParticipantRightsRequest>),
  );
  assert.equal(a!.id, b!.id);
  await next(await detail(a!.id), 'begin_review');
  const replay = await create(session, body);
  assert.equal(((await replay.json()) as ParticipantRightsRequest).status, 'under_review');
  assert.equal((await detail(a!.id)).history.length, 2);
  assert.equal(
    (await create(session, { ...body, details: 'Changed synthetic instruction' })).status,
    409,
  );
  const text = await (await own(session, a!.id)).text();
  for (const secret of [
    'Private synthetic triage note',
    'Private internal vendor',
    'actorId',
    'assignee',
    'evidenceRefs',
    'workItems',
    'offerId',
    'sourceReceiptId',
  ])
    assert.ok(!text.includes(secret), secret);
});
test('internal access limits viewers/unassigned staff and validates active assignees without broad identity grants', async () => {
  const fixture = await fresh();
  let row: RightsRequest = fixture.row;
  assert.equal((await request('rights', 'GET', undefined, 'viewer')).status, 403);
  assert.equal((await request(`rights/${row.id}`, 'GET', undefined, 'staff')).status, 404);
  assert.equal((await action(row, 'begin_review', {}, 'staff')).status, 404);
  for (const id of ['00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004'])
    assert.equal((await action(row, 'assign', { assigneeId: id })).status, 409);
  row = await next(row, 'assign', { assigneeId: '00000000-0000-4000-8000-000000000002' });
  assert.equal((await detail(row.id, 'staff')).id, row.id);
  row = await next(row, 'begin_review', {}, 'staff');
  assert.equal(
    (
      await action(
        row,
        'respond',
        {
          response: {
            language: 'en',
            text: 'Synthetic response',
            resolution: 'blocked',
            reviewedResponseAcknowledged: true,
          },
        },
        'staff',
      )
    ).status,
    403,
  );
  await admin.query(
    'UPDATE identity.memberships SET active=false WHERE tenant_id=$1 AND user_id=$2',
    [tenant, '00000000-0000-4000-8000-000000000002'],
  );
  try {
    assert.equal((await request(`rights/${row.id}`, 'GET', undefined, 'staff')).status, 403);
  } finally {
    await admin.query(
      'UPDATE identity.memberships SET active=true WHERE tenant_id=$1 AND user_id=$2',
      [tenant, '00000000-0000-4000-8000-000000000002'],
    );
  }
});
test('independent manual review and partial closure preserve unresolved obligations and approved public response', async () => {
  const created = await fresh('erasure');
  let row: RightsRequest = await next(created.row, 'assign', {
    assigneeId: '00000000-0000-4000-8000-000000000002',
  });
  row = await next(row, 'begin_review', {}, 'staff');
  const item = row.workItems.find((i) => i.status === 'pending')!,
    unknown = row.workItems.find((i) => i.status === 'unknown')!;
  assert.equal(
    (await action(row, 'declare_item', { workItemId: unknown.id }, 'staff')).status,
    409,
  );
  row = await next(row, 'declare_item', { workItemId: item.id }, 'staff');
  assert.equal((await action(row, 'verify_item', { workItemId: item.id }, 'staff')).status, 403);
  assert.equal((await action(row, 'verify_item', { workItemId: item.id })).status, 400);
  row = await next(row, 'verify_item', {
    workItemId: item.id,
    evidenceRefs: ['sample-evidence:independent-review'],
  });
  const response = {
    language: 'hi',
    text: 'काल्पनिक आंशिक उत्तर',
    resolution: 'partial',
    reviewedResponseAcknowledged: true,
  };
  assert.equal(
    (await action(row, 'respond', { response: { ...response, resolution: 'complete' } })).status,
    409,
  );
  assert.equal(
    (
      await action(row, 'respond', {
        response: { ...response, reviewedResponseAcknowledged: false },
      })
    ).status,
    400,
  );
  row = await next(row, 'respond', { response });
  assert.equal((await action(row, 'close')).status, 400);
  row = await next(row, 'close', { unresolvedAcknowledged: true });
  assert.equal(row.status, 'closed');
  assert.ok(row.workItems.some((i) => i.status === 'unknown'));
  assert.equal(row.responses[0]!.resolution, 'partial');
  const publicRow = (await (await own(created.session, row.id)).json()) as ParticipantRightsRequest;
  assert.equal(publicRow.status, 'closed');
  assert.equal(publicRow.responses[0]!.text, response.text);
  assert.ok(publicRow.progress.unknown > 0);
  assert.equal((await action(row, 'begin_review')).status, 409);
  row = await next(row, 'reopen');
  assert.equal(row.responses.length, 1);
});
test('same actor cannot verify and retention/block decisions never imply completion', async () => {
  let { row } = await fresh('correction');
  row = (await next(row, 'begin_review')) as RightsDetail;
  const pending = row.workItems.filter((i) => i.status === 'pending');
  row = (await next(row, 'declare_item', { workItemId: pending[0]!.id })) as RightsDetail;
  assert.equal(
    (
      await action(row, 'verify_item', {
        workItemId: pending[0]!.id,
        evidenceRefs: ['sample-evidence:other'],
      })
    ).status,
    403,
  );
  row = (await next(row, 'retain_item', { workItemId: pending[1]!.id })) as RightsDetail;
  row = (await next(row, 'block_item', {
    workItemId: pending[2]!.id,
    evidenceRefs: [],
  })) as RightsDetail;
  row = (await next(row, 'respond', {
    response: {
      language: 'en',
      text: 'Synthetic blockers and retention remain unreviewed.',
      resolution: 'blocked',
      reviewedResponseAcknowledged: true,
    },
  })) as RightsDetail;
  assert.ok(row.responses[0]!.unresolvedCount > 0);
  row = (await next(row, 'close', { unresolvedAcknowledged: true })) as RightsDetail;
  assert.ok(row.workItems.some((i) => i.status === 'retention_exception_declared'));
});
test('complete grievance response needs independent review while correction/erasure execute no destructive operations', async () => {
  let { row } = await fresh('grievance');
  row = (await next(row, 'assign', {
    assigneeId: '00000000-0000-4000-8000-000000000002',
  })) as RightsDetail;
  row = (await next(row, 'begin_review', {}, 'staff')) as RightsDetail;
  row = (await next(
    row,
    'declare_item',
    { workItemId: row.workItems[0]!.id },
    'staff',
  )) as RightsDetail;
  row = (await next(row, 'verify_item', {
    workItemId: row.workItems[0]!.id,
    evidenceRefs: ['sample-evidence:owner-review'],
  })) as RightsDetail;
  row = (await next(row, 'respond', {
    response: {
      language: 'en',
      text: 'Synthetic case reviewed.',
      resolution: 'complete',
      reviewedResponseAcknowledged: true,
    },
  })) as RightsDetail;
  row = (await next(row, 'close')) as RightsDetail;
  assert.equal(row.responses[0]!.unresolvedCount, 0);
  assert.equal(
    (await admin.query('SELECT version FROM workspace.register_entries WHERE id=$1', [entry.id]))
      .rows[0].version,
    entry.version,
  );
});
test('withdrawal follow-up links are pinned but new rights work never inherits a declared outcome', async () => {
  const selected = await offer(),
    session = await start(selected);
  assert.equal((await submit(session, payload(selected, ['allow', 'allow']))).status, 201);
  const withdrawal = await request(
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
  assert.equal(withdrawal.status, 201);
  const receipt = (await withdrawal.json()) as ConsentReceipt;
  const response = await create(session, intake({ kind: 'erasure' }));
  assert.equal(response.status, 201);
  const row = await detail(((await response.json()) as ParticipantRightsRequest).id);
  assert.equal(row.source.sourceReceiptId, receipt.id);
  assert.ok(row.workItems.some((i) => i.relatedFollowupTaskId));
  assert.ok(row.workItems.every((i) => ['pending', 'unknown'].includes(i.status)));
});
test('different concurrent commands accept one version and audit hash chain remains immutable', async () => {
  const { row } = await fresh();
  const responses = await Promise.all([action(row, 'begin_review'), action(row, 'begin_review')]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const current = await detail(row.id);
  assert.equal(current.version, 2);
  const chronological = [...current.history].reverse();
  let previous: string | null = null;
  for (const event of chronological) {
    const { eventHash, ...body } = event;
    assert.equal(event.previousHash, previous);
    assert.equal(eventHash, followupDigest(body));
    previous = eventHash;
  }
  for (const context of [null, otherTenant])
    assert.equal(
      (
        await db.transaction(context, (client) =>
          client.query('SELECT id FROM workspace.rights_requests WHERE id=$1', [row.id]),
        )
      ).rows.length,
      0,
    );
  for (const sql of [
    'UPDATE workspace.rights_events SET data=data WHERE request_id=$1',
    'DELETE FROM workspace.rights_requests WHERE id=$1',
    'UPDATE workspace.rights_commands SET response=response WHERE actor_id=$1',
  ])
    await assert.rejects(
      db.transaction(tenant, (client) => client.query(sql, [row.id])),
      /permission denied/,
    );
});
test('intake command failure rolls back request and event and retry succeeds atomically', async () => {
  const session = await start(await offer()),
    body = intake(),
    before = (
      await admin.query(
        'SELECT count(*)::int AS n FROM workspace.rights_requests WHERE session_id=$1',
        [session.participant.id],
      )
    ).rows[0].n;
  await admin.query(
    `CREATE FUNCTION workspace.rights_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key='${body.idempotencyKey}'::uuid THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    'CREATE TRIGGER rights_fixture_failure BEFORE INSERT ON workspace.rights_commands FOR EACH ROW EXECUTE FUNCTION workspace.rights_fixture_failure()',
  );
  try {
    assert.equal((await create(session, body)).status, 500);
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int AS n FROM workspace.rights_requests WHERE session_id=$1',
          [session.participant.id],
        )
      ).rows[0].n,
      before,
    );
  } finally {
    await admin.query('DROP TRIGGER rights_fixture_failure ON workspace.rights_commands');
    await admin.query('DROP FUNCTION workspace.rights_fixture_failure()');
  }
  assert.equal((await create(session, body)).status, 201);
});

test('branch changes remove staff access immediately and command failures roll back triage version and history', async () => {
  let row: RightsRequest = (await fresh()).row;
  row = await next(row, 'assign', { assigneeId: '00000000-0000-4000-8000-000000000002' });
  const alternate = randomUUID();
  await admin.query('INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3)', [
    tenant,
    alternate,
    'Synthetic rights branch',
  ]);
  try {
    await admin.query(
      'UPDATE identity.memberships SET branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
      [alternate, tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal((await request(`rights/${row.id}`, 'GET', undefined, 'staff')).status, 404);
  } finally {
    await admin.query(
      'UPDATE identity.memberships SET branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
      [branch, tenant, '00000000-0000-4000-8000-000000000002'],
    );
    await admin.query('DELETE FROM workspace.branches WHERE id=$1', [alternate]);
  }
  const key = randomUUID();
  rightsKeys.push(key);
  const before = await detail(row.id);
  await admin.query(
    `CREATE FUNCTION workspace.rights_action_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key='${key}'::uuid THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    'CREATE TRIGGER rights_action_failure BEFORE INSERT ON workspace.rights_commands FOR EACH ROW EXECUTE FUNCTION workspace.rights_action_failure()',
  );
  try {
    assert.equal((await action(row, 'begin_review', { idempotencyKey: key })).status, 500);
    assert.deepEqual(await detail(row.id), before);
  } finally {
    await admin.query('DROP TRIGGER rights_action_failure ON workspace.rights_commands');
    await admin.query('DROP FUNCTION workspace.rights_action_failure()');
  }
  assert.equal((await action(row, 'begin_review', { idempotencyKey: key })).status, 201);
});
