import 'reflect-metadata';
import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../../src/bootstrap/create-app.js';
import { loadConfig } from '../../src/config/runtime.config.js';
import { hashToken } from '../../src/auth/security-hash.js';
import { followupDigest } from '../../src/followups/followup-locations.js';
import { Database } from '../../src/database/database.service.js';
import type {
  RetentionPolicy,
  RetentionHold,
  RetentionPreviewPage,
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
  if (entry) {
    await admin.query(
      'DELETE FROM workspace.retention_commands WHERE idempotency_key=ANY($1::uuid[])',
      [retentionKeys],
    );
    for (const kind of ['policy', 'hold'])
      await admin.query(
        `DELETE FROM workspace.retention_${kind}_events WHERE record_id IN (SELECT id FROM workspace.retention_${kind === 'policy' ? 'policies' : 'holds'} WHERE entry_id=$1)`,
        [entry.id],
      );
    for (const table of ['retention_previews', 'retention_holds', 'retention_policies'])
      await admin.query(`DELETE FROM workspace.${table} WHERE entry_id=$1`, [entry.id]);
  }

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
const retentionKeys: string[] = [];
function command(extra: object = {}) {
  const key = randomUUID();
  retentionKeys.push(key);
  return { syntheticOnlyAcknowledged: true, idempotencyKey: key, ...extra };
}
async function policy(extra: object = {}, role = 'owner') {
  const response = await request(
    'retention/policies',
    'POST',
    command({
      entryId: entry.id,
      entryVersion: entry.version,
      name: 'Synthetic local policy',
      durationDays: 1,
      rationale: 'User-entered invented duration; legal review unreviewed.',
      ...extra,
    }),
    role,
  );
  assert.equal(response.status, 201, await response.clone().text());
  return response.json() as Promise<RetentionPolicy>;
}
async function policyAction(
  row: RetentionPolicy,
  action: string,
  extra: object = {},
  role = 'owner',
) {
  return request(
    `retention/policies/${row.id}/actions`,
    'POST',
    command({
      version: row.version,
      action,
      reason: 'Synthetic internal decision only',
      ...(action === 'review' ? { internalReviewAcknowledged: true } : {}),
      ...extra,
    }),
    role,
  );
}
async function reviewed() {
  let row = await policy();
  row = (await (await policyAction(row, 'submit')).json()) as RetentionPolicy;
  return (await policyAction(row, 'review')).json() as Promise<RetentionPolicy>;
}
async function hold(extra: object = {}) {
  const response = await request(
    'retention/holds',
    'POST',
    command({
      entryId: entry.id,
      scope: 'activity',
      reason: 'Synthetic preservation reason',
      ...extra,
    }),
  );
  assert.equal(response.status, 201, await response.clone().text());
  return response.json() as Promise<RetentionHold>;
}
async function preview(extra: object = {}) {
  const response = await request(
    'retention/previews',
    'POST',
    command({ entryId: entry.id, asOf: '2027-01-01T00:00:00Z', ...extra }),
  );
  assert.equal(response.status, 201, await response.clone().text());
  const first = (await response.json()) as RetentionPreviewPage;
  const items = [...first.items];
  let cursor = first.nextCursor;
  while (cursor) {
    const next = await saved(first.id, 'limit=20&cursor=' + cursor);
    items.push(...next.items);
    cursor = next.nextCursor;
  }
  return { ...first, items };
}
async function saved(id: string, query = '') {
  const response = await request(`retention/previews/${id}${query ? '?' + query : ''}`);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json() as Promise<RetentionPreviewPage>;
}
async function consentFixture() {
  const selected = await offer(),
    session = await start(selected);
  const response = await submit(session, payload(selected, ['allow', 'allow']));
  assert.equal(response.status, 201);
  return { session, receipt: (await response.json()) as ConsentReceipt };
}
beforeEach(async () => {
  if (!entry) return;
  for (const { data } of (
    await admin.query(
      "SELECT data FROM workspace.retention_policies WHERE entry_id=$1 AND data->>'status'<>'retired'",
      [entry.id],
    )
  ).rows)
    assert.equal((await policyAction(data as RetentionPolicy, 'retire')).status, 201);
  for (const { data } of (
    await admin.query(
      "SELECT data FROM workspace.retention_holds WHERE entry_id=$1 AND data->>'status'='active'",
      [entry.id],
    )
  ).rows)
    assert.equal(
      (
        await request(
          `retention/holds/${data.id}/release`,
          'POST',
          command({ version: data.version, reason: 'Synthetic test isolation release' }),
        )
      ).status,
      201,
    );
});
test('policy drafts require explicit duration/rationale, legal metadata is not accepted and staff cannot internally approve', async () => {
  for (const extra of [
    { durationDays: 0 },
    { durationDays: 36501 },
    { durationDays: 1.5 },
    { rationale: ' ' },
    { name: ' ' },
    { legalReview: 'approved' },
    { entryVersion: 0 },
    { syntheticOnlyAcknowledged: false },
  ])
    assert.equal(
      (
        await request(
          'retention/policies',
          'POST',
          command({
            entryId: entry.id,
            entryVersion: entry.version,
            name: 'Synthetic',
            durationDays: 1,
            rationale: 'Unreviewed',
            ...extra,
          }),
        )
      ).status,
      400,
    );
  let row = await policy({}, 'staff');
  assert.equal(row.status, 'draft');
  assert.equal(row.legalReview, 'unreviewed');
  assert.equal((await policyAction(row, 'review')).status, 409);
  row = (await (await policyAction(row, 'submit', {}, 'staff')).json()) as RetentionPolicy;
  assert.equal((await policyAction(row, 'review', {}, 'staff')).status, 403);
  assert.equal(
    (await policyAction(row, 'review', { internalReviewAcknowledged: false })).status,
    400,
  );
  row = (await (await policyAction(row, 'review')).json()) as RetentionPolicy;
  assert.equal(row.status, 'internally_reviewed');
  assert.equal(row.legalReview, 'unreviewed');
});
test('editing policy revokes internal review and optimistic concurrent edits preserve one winner and immutable history', async () => {
  const row = await reviewed(),
    body = command({
      entryVersion: entry.version,
      version: row.version,
      name: 'Synthetic revised',
      durationDays: 2,
      rationale: 'New invented decision',
    });
  const responses = await Promise.all([
    request(`retention/policies/${row.id}`, 'PUT', body),
    request(`retention/policies/${row.id}`, 'PUT', {
      ...body,
      idempotencyKey: command().idempotencyKey,
      durationDays: 3,
    }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const detail = (await (await request(`retention/policies/${row.id}`)).json()) as {
    record: RetentionPolicy;
    history: { eventHash: string; previousHash: string | null; version: number }[];
  };
  assert.equal(detail.record.status, 'draft');
  assert.equal(detail.history.length, 4);
  for (const event of detail.history) {
    const { eventHash, ...content } = event;
    assert.equal(eventHash, followupDigest(content));
  }
});
test('identical policy and preview retries deduplicate, payload reuse conflicts and repeatable-read races create one snapshot', async () => {
  const body = command({
      entryId: entry.id,
      entryVersion: entry.version,
      name: 'Synthetic repeated',
      durationDays: 1,
      rationale: 'Invented unreviewed',
    }),
    responses = await Promise.all([
      request('retention/policies', 'POST', body),
      request('retention/policies', 'POST', body),
    ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201],
  );
  const values = await Promise.all(responses.map((r) => r.json() as Promise<RetentionPolicy>));
  assert.equal(values[0]!.id, values[1]!.id);
  assert.equal(
    (await request('retention/policies', 'POST', { ...body, durationDays: 2 })).status,
    409,
  );
  const input = command({ entryId: entry.id, asOf: '2027-01-01T00:00:00Z' }),
    runs = await Promise.all([
      request('retention/previews', 'POST', input),
      request('retention/previews', 'POST', input),
    ]);
  assert.deepEqual(
    runs.map((r) => r.status),
    [201, 201],
  );
  const snapshots = await Promise.all(runs.map((r) => r.json() as Promise<RetentionPreviewPage>));
  assert.equal(snapshots[0]!.id, snapshots[1]!.id);
  assert.equal(
    (await request('retention/previews', 'POST', { ...input, asOf: '2027-01-02T00:00:00Z' }))
      .status,
    409,
  );
  assert.equal(
    (
      await admin.query('SELECT count(*)::int AS n FROM workspace.retention_previews WHERE id=$1', [
        snapshots[0]!.id,
      ])
    ).rows[0].n,
    1,
  );
});
test('duration boundary is UTC instant based, equivalent offsets match and unknown places never become candidates', async () => {
  await reviewed();
  const { receipt } = await consentFixture(),
    due = new Date(Date.parse(receipt.occurredAt) + 86400000).toISOString();
  const early = await preview({ asOf: new Date(Date.parse(due) - 1).toISOString() }),
    exact = await preview({ asOf: due });
  assert.ok(
    early.items
      .filter((i) => i.receiptId === receipt.id && i.location.mapping === 'declared')
      .every((i) => i.outcome === 'not_due'),
  );
  assert.ok(
    exact.items
      .filter((i) => i.receiptId === receipt.id && i.location.mapping === 'declared')
      .every((i) => i.outcome === 'candidate_review'),
  );
  assert.ok(
    exact.items
      .filter((i) => i.location.mapping === 'unknown')
      .every((i) => i.outcome === 'unknown'),
  );
  const input = command({ entryId: entry.id, asOf: '2027-01-01T05:30:00+05:30' }),
    first = await request('retention/previews', 'POST', input),
    second = await request('retention/previews', 'POST', {
      ...input,
      asOf: '2027-01-01T00:00:00Z',
    });
  assert.equal(
    ((await first.json()) as RetentionPreviewPage).id,
    ((await second.json()) as RetentionPreviewPage).id,
  );
  for (const date of [
    '2026-01-01',
    '2026-01-01T00:00:00',
    '2026-02-30T00:00:00Z',
    '2026-01-01T24:00:00Z',
  ])
    assert.equal(
      (await request('retention/previews', 'POST', command({ entryId: entry.id, asOf: date })))
        .status,
      400,
    );
});
test('activity holds precede policy conflicts/unknowns and release never executes or resolves the underlying conflicts', async () => {
  await reviewed();
  await reviewed();
  const holdRow = await hold(),
    run = await preview();
  assert.ok(
    run.items.every(
      (i) =>
        i.outcome === 'held' &&
        i.reasons.includes('active_hold') &&
        i.reasons.includes('policy_conflict'),
    ),
  );
  assert.equal(
    (
      await request(
        `retention/holds/${holdRow.id}/release`,
        'POST',
        command({ version: 99, reason: 'Synthetic' }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        `retention/holds/${holdRow.id}/release`,
        'POST',
        command({ version: holdRow.version, reason: ' ' }),
      )
    ).status,
    400,
  );
  const input = command({
    version: holdRow.version,
    reason: 'Synthetic owner release; no legal conclusion',
  });
  const releases = await Promise.all([
    request(`retention/holds/${holdRow.id}/release`, 'POST', input),
    request(`retention/holds/${holdRow.id}/release`, 'POST', input),
  ]);
  assert.deepEqual(
    releases.map((r) => r.status),
    [201, 201],
  );
  const after = await preview();
  assert.ok(after.items.every((i) => i.outcome === 'conflict'));
  assert.equal((await saved(run.id)).freshness, 'stale');
});
test('sample-record and location holds validate activity membership and affect only their declared target', async () => {
  await reviewed();
  const a = await consentFixture(),
    b = await consentFixture(),
    ctx = (await (await request(`retention/activities/${entry.id}/context`)).json()) as {
      locations: { key: string }[];
    };
  assert.equal(
    (
      await request(
        'retention/holds',
        'POST',
        command({
          entryId: entry.id,
          scope: 'sample_record',
          target: randomUUID(),
          reason: 'Synthetic',
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        'retention/holds',
        'POST',
        command({
          entryId: entry.id,
          scope: 'activity',
          target: a.receipt.sessionId,
          reason: 'Synthetic',
        }),
      )
    ).status,
    400,
  );
  await hold({ scope: 'sample_record', target: a.receipt.sessionId });
  let run = await preview();
  assert.ok(
    run.items
      .filter((i) => i.sampleRecordId === a.receipt.sessionId)
      .every((i) => i.outcome === 'held'),
  );
  assert.ok(
    run.items
      .filter((i) => i.sampleRecordId === b.receipt.sessionId)
      .every((i) => i.outcome !== 'held'),
  );
  await hold({ scope: 'location', target: ctx.locations[0]!.key });
  run = await preview();
  assert.ok(
    run.items
      .filter((i) => i.location.key === ctx.locations[0]!.key)
      .every((i) => i.outcome === 'held'),
  );
});
test('rights without a receipt retain an unknown anchor and surface review conflict; withdrawal remains a separate review obligation', async () => {
  await reviewed();
  const rights = await fresh('erasure');
  let run = await preview();
  assert.ok(
    run.items.some(
      (i) =>
        i.sampleRecordId === rights.row.sessionId &&
        i.reasons.includes('rights_review') &&
        i.reasons.includes('missing_reference_time'),
    ),
  );
  const { session, receipt } = await consentFixture();
  assert.equal(
    (
      await request(
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
      )
    ).status,
    201,
  );
  run = await preview();
  const items = run.items.filter((i) => i.sampleRecordId === receipt.sessionId);
  assert.ok(
    items.every((i) => i.outcome === 'conflict' && i.reasons.includes('withdrawal_review')),
  );
  assert.ok(items.some((i) => i.reasons.includes('followup_review')));
});
test('stale snapshots preserve original items and input hash after policy/source changes and source disappearance', async () => {
  const row = await reviewed(),
    run = await preview(),
    oldItems = run.items;
  assert.equal(run.freshness, 'matches_loaded_inputs');
  await policy();
  let loaded = await saved(run.id);
  assert.equal(loaded.freshness, 'stale');
  assert.deepEqual(loaded.items, oldItems);
  assert.equal(loaded.inputHash, run.inputHash);
  const original = (
    await admin.query('SELECT version FROM workspace.register_entries WHERE id=$1', [entry.id])
  ).rows[0].version;
  try {
    await admin.query('UPDATE workspace.register_entries SET version=version+1 WHERE id=$1', [
      entry.id,
    ]);
    assert.equal((await saved(run.id)).freshness, 'stale');
    assert.equal((await policyAction(row, 'retire')).status, 201);
  } finally {
    await admin.query('UPDATE workspace.register_entries SET version=$1 WHERE id=$2', [
      original,
      entry.id,
    ]);
  }
  const alternate = randomUUID();
  await admin.query('INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3)', [
    tenant,
    alternate,
    'Synthetic retention branch',
  ]);
  try {
    await admin.query('UPDATE workspace.register_entries SET branch_id=$1 WHERE id=$2', [
      alternate,
      entry.id,
    ]);
    loaded = await saved(run.id);
    assert.equal(loaded.freshness, 'source_unavailable');
    assert.deepEqual(loaded.items, oldItems);
  } finally {
    await admin.query('UPDATE workspace.register_entries SET branch_id=$1 WHERE id=$2', [
      branch,
      entry.id,
    ]);
    await admin.query('DELETE FROM workspace.branches WHERE id=$1', [alternate]);
  }
});
test('policy/hold/preview history is tenant/branch/role scoped and participant cookies never grant owner actions', async () => {
  const p = await policy(),
    h = await hold(),
    run = await preview();
  for (const role of ['staff', 'viewer', 'operator']) {
    assert.equal(
      (await request('retention/holds?entryId=' + entry.id, 'GET', undefined, role)).status,
      403,
    );
    assert.equal(
      (await request(`retention/previews/${run.id}`, 'GET', undefined, role)).status,
      403,
    );
    assert.equal(
      (
        await request(
          'retention/holds',
          'POST',
          command({ entryId: entry.id, scope: 'activity', reason: 'Synthetic' }),
          role,
        )
      ).status,
      403,
    );
  }
  assert.equal(
    (await request('retention/policies?entryId=' + entry.id, 'GET', undefined, 'staff')).status,
    200,
  );
  assert.equal(
    (await request(`retention/policies/${p.id}`, 'GET', undefined, 'viewer')).status,
    403,
  );
  for (const path of [
    `retention/policies/${p.id}`,
    `retention/holds/${h.id}`,
    `retention/previews/${run.id}`,
  ])
    assert.equal((await request(path, 'GET', undefined, 'other', '', otherTenant)).status, 404);
  for (const context of [null, otherTenant])
    assert.equal(
      (
        await db.transaction(context, (client) =>
          client.query('SELECT id FROM workspace.retention_previews WHERE id=$1', [run.id]),
        )
      ).rows.length,
      0,
    );
});
test('bounded preview/list pages validate cursors and return deterministic immutable rows without payloads or execution endpoint', async () => {
  await reviewed();
  await consentFixture();
  const run = await preview(),
    first = await saved(run.id, 'limit=1');
  assert.equal(first.items.length, 1);
  assert.ok(first.nextCursor);
  const second = await saved(run.id, 'limit=1&cursor=' + first.nextCursor);
  assert.notEqual(first.items[0]!.key, second.items[0]!.key);
  for (const q of ['limit=0', 'limit=51', 'cursor=bad', 'limit=2&cursor=' + first.nextCursor])
    assert.equal((await request(`retention/previews/${run.id}?` + q)).status, 400);
  assert.equal((await request(`retention/previews/${run.id}/execute`, 'POST', {})).status, 404);
  const text = JSON.stringify(run);
  for (const token of [
    'Synthetic request instruction',
    'requestedValue',
    'tokenHash',
    'owner@demo',
    'Private synthetic triage note',
  ])
    assert.ok(!text.includes(token));
  const paged = await request(`retention/policies?entryId=${entry.id}&limit=1`);
  assert.equal(paged.status, 200);
  assert.equal(((await paged.json()) as { items: unknown[] }).items.length, 1);
});
test('snapshot/command insert failure rolls back wholly and immutable grants protect preview and histories', async () => {
  const input = command({ entryId: entry.id, asOf: '2027-01-01T00:00:00Z' }),
    before = (
      await admin.query(
        'SELECT count(*)::int AS n FROM workspace.retention_previews WHERE entry_id=$1',
        [entry.id],
      )
    ).rows[0].n;
  await admin.query(
    `CREATE FUNCTION workspace.retention_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key='${input.idempotencyKey}'::uuid THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    'CREATE TRIGGER retention_fixture_failure BEFORE INSERT ON workspace.retention_commands FOR EACH ROW EXECUTE FUNCTION workspace.retention_fixture_failure()',
  );
  try {
    assert.equal((await request('retention/previews', 'POST', input)).status, 500);
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int AS n FROM workspace.retention_previews WHERE entry_id=$1',
          [entry.id],
        )
      ).rows[0].n,
      before,
    );
  } finally {
    await admin.query('DROP TRIGGER retention_fixture_failure ON workspace.retention_commands');
    await admin.query('DROP FUNCTION workspace.retention_fixture_failure()');
  }
  assert.equal((await request('retention/previews', 'POST', input)).status, 201);
  for (const table of [
    'retention_previews',
    'retention_policy_events',
    'retention_hold_events',
    'retention_commands',
  ])
    await assert.rejects(
      db.transaction(tenant, (client) => client.query(`UPDATE workspace.${table} SET data=data`)),
      /permission denied|column/,
    );
});
