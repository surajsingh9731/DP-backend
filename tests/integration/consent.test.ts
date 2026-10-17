import 'reflect-metadata';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { createApp } from '../../src/bootstrap/create-app.js';
import { loadConfig } from '../../src/config/runtime.config.js';
import { hashToken } from '../../src/auth/security-hash.js';
import { Database } from '../../src/database/database.service.js';
import { consentHash } from '../../src/consent-sandbox/consent.policy.js';
import type {
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
test('synthetic catalog validation, owner authority and explicit acknowledgement reject invalid or invented assurance', async () => {
  for (const extra of [
    { purposes: [] },
    { purposes: [purposes[0], purposes[0]] },
    { purposes: [{ ...purposes[0], labelEn: ' ' }] },
    { syntheticOnlyAcknowledged: false },
    { contactVerification: 'verified' },
    { purposes: [{ ...purposes[0], required: true }] },
  ])
    assert.equal(
      (
        await request('consent-sandbox/offers', 'POST', {
          noticeId: notice.id,
          purposes,
          syntheticOnlyAcknowledged: true,
          idempotencyKey: randomUUID(),
          ...extra,
        })
      ).status,
      400,
    );
  for (const role of ['staff', 'viewer', 'operator'])
    assert.equal(
      (
        await request(
          'consent-sandbox/offers',
          'POST',
          {
            noticeId: notice.id,
            purposes,
            syntheticOnlyAcknowledged: true,
            idempotencyKey: randomUUID(),
          },
          role,
        )
      ).status,
      403,
    );
  assert.equal(
    (await request('consent-sandbox/offers', 'GET', undefined, 'anonymous')).status,
    401,
  );
  const selected = await offer();
  assert.ok(!JSON.stringify(selected).includes('Private internal vendor'));
  assert.ok(!('registerData' in selected.notice));
  for (const extra of [
    { syntheticAdultAcknowledged: false },
    { name: 'Real person' },
    { age: 21 },
    { guardianVerified: true },
  ])
    assert.equal(
      (
        await request('consent-sandbox/sessions', 'POST', {
          offerId: selected.id,
          syntheticAdultAcknowledged: true,
          ...extra,
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await request(
        'consent-sandbox/sessions',
        'POST',
        { offerId: selected.id, syntheticAdultAcknowledged: true },
        'viewer',
      )
    ).status,
    403,
  );
});
test('catalog creation retries are idempotent and changed payload with the same key conflicts', async () => {
  const body = {
    noticeId: notice.id,
    purposes,
    syntheticOnlyAcknowledged: true,
    idempotencyKey: randomUUID(),
  };
  const responses = await Promise.all([
    request('consent-sandbox/offers', 'POST', body),
    request('consent-sandbox/offers', 'POST', body),
  ]);
  const values = await Promise.all(responses.map((r) => r.json() as Promise<ConsentOffer>));
  assert.equal(values[0]!.id, values[1]!.id);
  assert.equal(
    (
      await request('consent-sandbox/offers', 'POST', {
        ...body,
        purposes: [{ ...purposes[0], labelEn: 'Changed' }, purposes[1]],
      })
    ).status,
    409,
  );
});
test('no choices are inferred; incomplete, duplicate, extra and mismatched version/language payloads reject', async () => {
  const selected = await offer(),
    session = await start(selected),
    body = payload(selected);
  for (const extra of [
    { choices: [] },
    { choices: body.choices.slice(0, 1) },
    { choices: [body.choices[0], body.choices[0]] },
    { choices: [body.choices[0], { purposeId: randomUUID(), decision: 'allow' }] },
    { offerVersion: selected.version + 1 },
    { catalogHash: '0'.repeat(64) },
    { offerId: randomUUID() },
    { interfaceLanguage: 'fr' },
    { syntheticOnlyAcknowledged: false },
    { choices: [{ ...body.choices[0], decision: true }, body.choices[1]] },
  ]) {
    const response = await submit(session, { ...body, ...extra });
    assert.ok([400, 409].includes(response.status), await response.text());
  }
  assert.equal(
    (
      await admin.query('SELECT version FROM workspace.consent_participants WHERE id=$1', [
        session.participant.id,
      ])
    ).rows[0].version,
    0,
  );
});
test('partial choices bind the exact notice, both languages, server time and synthetic assurance; concurrent retries return one immutable receipt', async () => {
  const selected = await offer(),
    session = await start(selected),
    body = payload(selected);
  const responses = await Promise.all([submit(session, body), submit(session, body)]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201],
  );
  const [first, second] = await Promise.all(
    responses.map((r) => r.json() as Promise<ConsentReceipt>),
  );
  assert.equal(first!.id, second!.id);
  assert.deepEqual(
    first!.choices.map((c) => c.decision),
    ['allow', 'decline'],
  );
  assert.equal(first!.offer.notice.body, notice.preview.body);
  assert.equal(first!.offer.notice.language, 'en');
  assert.equal(first!.interfaceLanguage, 'hi');
  assert.equal(first!.assurance, 'unverified-synthetic-adult');
  assert.equal(first!.deletionStatus, 'not-performed');
  assert.ok(!isNaN(Date.parse(first!.occurredAt)));
  const { receiptHash, ...content } = first!;
  assert.equal(receiptHash, consentHash(content));
  assert.equal(
    (await submit(session, { ...body, choices: [...body.choices].reverse() })).status,
    201,
  );
  assert.equal((await submit(session, { ...body, interfaceLanguage: 'en' })).status, 409);
  assert.equal((await submit(session, { ...body, idempotencyKey: randomUUID() })).status, 409);
  const saved = await admin.query(
    'SELECT token_hash FROM workspace.consent_participants WHERE id=$1',
    [session.participant.id],
  );
  assert.notEqual(saved.rows[0].token_hash, session.cookie.split('=')[1]);
  for (const sql of [
    'UPDATE workspace.consent_receipts SET data=data WHERE session_id=$1',
    'DELETE FROM workspace.consent_receipts WHERE session_id=$1',
    'UPDATE workspace.consent_offers SET data=data WHERE id=$1',
  ])
    await assert.rejects(
      db.transaction(tenant, (client) =>
        client.query(sql, [sql.includes('consent_offers') ? selected.id : session.participant.id]),
      ),
      /permission denied/,
    );
});
test('all-decline and all-allow have first-class receipts without outbox delivery', async () => {
  const before = (await admin.query('SELECT count(*)::int AS total FROM workspace.outbox')).rows[0]
    .total;
  for (const decision of ['decline', 'allow'] as const) {
    const selected = await offer(),
      session = await start(selected);
    const response = await submit(session, payload(selected, [decision, decision]));
    assert.equal(response.status, 201);
    const receipt = (await response.json()) as ConsentReceipt;
    assert.ok(receipt.choices.every((c) => c.decision === decision));
  }
  assert.equal(
    (await admin.query('SELECT count(*)::int AS total FROM workspace.outbox')).rows[0].total,
    before,
  );
});
test('participant cookie, creating actor, tenant, branch, current role and membership are enforced independently of workspace auth', async () => {
  const selected = await offer(),
    session = await start(selected, 'staff'),
    path = `consent-sandbox/sessions/${session.participant.id}/choices`,
    body = payload(selected);
  assert.equal((await request(path, 'POST', body, 'staff')).status, 403);
  assert.equal((await request(path, 'POST', body, 'owner', session.cookie)).status, 403);
  assert.equal((await request(path, 'POST', body, 'viewer', session.cookie)).status, 403);
  assert.equal(
    (await request(path, 'POST', body, 'other', session.cookie, otherTenant)).status,
    404,
  );
  assert.equal(
    (await request('consent-sandbox/offers', 'GET', undefined, 'owner', '', otherTenant)).status,
    403,
  );
  const second = await start(selected, 'staff');
  assert.equal((await request(path, 'POST', body, 'staff', second.cookie)).status, 403);
  const alternate = randomUUID();
  await admin.query('INSERT INTO workspace.branches(tenant_id,id,name) VALUES($1,$2,$3)', [
    tenant,
    alternate,
    'Synthetic alternate',
  ]);
  try {
    await admin.query(
      'UPDATE identity.memberships SET branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
      [alternate, tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal((await submit(session, body)).status, 404);
    await admin.query(
      'UPDATE identity.memberships SET active=false WHERE tenant_id=$1 AND user_id=$2',
      [tenant, '00000000-0000-4000-8000-000000000002'],
    );
    assert.equal((await submit(session, body)).status, 403);
  } finally {
    await admin.query(
      'UPDATE identity.memberships SET active=true,branch_id=$1 WHERE tenant_id=$2 AND user_id=$3',
      [branch, tenant, '00000000-0000-4000-8000-000000000002'],
    );
    await admin.query('DELETE FROM workspace.branches WHERE id=$1', [alternate]);
  }
  for (const context of [null, otherTenant])
    assert.equal(
      (
        await db.transaction(context, (client) =>
          client.query('SELECT id FROM workspace.consent_participants WHERE id=$1', [
            session.participant.id,
          ]),
        )
      ).rows.length,
      0,
    );
});
test('expiry and explicit end revoke participant authority while preserving committed history', async () => {
  const selected = await offer(),
    session = await start(selected),
    body = payload(selected);
  assert.equal((await submit(session, body)).status, 201);
  assert.equal(
    (
      await request(
        `consent-sandbox/sessions/${session.participant.id}/end`,
        'POST',
        {},
        'owner',
        session.cookie,
      )
    ).status,
    201,
  );
  assert.equal((await submit(session, body)).status, 403);
  const expired = await start(selected);
  await admin.query(
    "UPDATE workspace.consent_participants SET expires_at=now()-interval '1 second' WHERE id=$1",
    [expired.participant.id],
  );
  assert.equal((await submit(expired, payload(selected))).status, 403);
  assert.equal((await request('consent-sandbox/receipts', 'GET', undefined, 'viewer')).status, 200);
});
test('new catalog blocks unused sessions while committed receipt replay and purpose withdrawal retain old history', async () => {
  const selected = await offer(),
    unused = await start(selected),
    used = await start(selected),
    body = payload(selected, ['allow', 'allow']);
  const original = (await (await submit(used, body)).json()) as ConsentReceipt;
  await offer();
  assert.equal((await submit(unused, payload(selected))).status, 409);
  assert.equal(
    (
      await request('consent-sandbox/sessions', 'POST', {
        offerId: selected.id,
        syntheticAdultAcknowledged: true,
      })
    ).status,
    409,
  );
  assert.equal((await submit(used, body)).status, 201);
  const path = `consent-sandbox/sessions/${used.participant.id}/withdraw`,
    withdraw = {
      version: 1,
      purposeIds: [purposes[0]!.id],
      interfaceLanguage: 'en',
      idempotencyKey: randomUUID(),
    };
  const responses = await Promise.all([
    request(path, 'POST', withdraw, 'owner', used.cookie),
    request(path, 'POST', withdraw, 'owner', used.cookie),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201],
  );
  const receipts = await Promise.all(responses.map((r) => r.json() as Promise<ConsentReceipt>));
  assert.equal(receipts[0]!.id, receipts[1]!.id);
  assert.equal(receipts[0]!.previousReceiptHash, original.receiptHash);
  assert.deepEqual(
    receipts[0]!.choices.map((c) => c.decision),
    ['decline', 'allow'],
  );
  assert.equal(receipts[0]!.deletionStatus, 'not-performed');
  assert.equal(
    (
      await request(
        path,
        'POST',
        { ...withdraw, idempotencyKey: randomUUID() },
        'owner',
        used.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        path,
        'POST',
        { ...withdraw, version: 2, idempotencyKey: randomUUID() },
        'owner',
        used.cookie,
      )
    ).status,
    400,
  );
  const detail = (await (
    await request(
      `consent-sandbox/sessions/${used.participant.id}`,
      'GET',
      undefined,
      'owner',
      used.cookie,
    )
  ).json()) as ConsentParticipant;
  assert.equal(detail.receipts.length, 2);
  assert.deepEqual(detail.receipts[1], original);
});
test('command failure rolls back receipt, participant version and replay receipt atomically', async () => {
  const selected = await offer(),
    session = await start(selected),
    body = payload(selected),
    key = body.idempotencyKey;
  await admin.query(
    `CREATE FUNCTION workspace.consent_failure_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key='${key}'::uuid THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
  );
  await admin.query(
    'CREATE TRIGGER consent_failure BEFORE INSERT ON workspace.consent_commands FOR EACH ROW EXECUTE FUNCTION workspace.consent_failure_fixture()',
  );
  try {
    assert.equal((await submit(session, body)).status, 500);
    const row = await admin.query(
      'SELECT version FROM workspace.consent_participants WHERE id=$1',
      [session.participant.id],
    );
    assert.equal(row.rows[0].version, 0);
    assert.equal(
      (
        await admin.query('SELECT id FROM workspace.consent_receipts WHERE session_id=$1', [
          session.participant.id,
        ])
      ).rowCount,
      0,
    );
  } finally {
    await admin.query('DROP TRIGGER consent_failure ON workspace.consent_commands');
    await admin.query('DROP FUNCTION workspace.consent_failure_fixture()');
  }
  assert.equal((await submit(session, body)).status, 201);
});
test('concurrent distinct submissions accept one receipt and refuse a second initial choice event', async () => {
  const selected = await offer(),
    session = await start(selected);
  const responses = await Promise.all([
    submit(session, payload(selected, ['allow', 'allow'])),
    submit(session, payload(selected, ['decline', 'decline'])),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (
      await admin.query('SELECT id FROM workspace.consent_receipts WHERE session_id=$1', [
        session.participant.id,
      ])
    ).rowCount,
    1,
  );
});
test('withdrawal rejects unknown, duplicate and already declined purposes without appending a receipt', async () => {
  const selected = await offer(),
    session = await start(selected);
  assert.equal((await submit(session, payload(selected))).status, 201);
  for (const ids of [[randomUUID()], [purposes[1]!.id], [purposes[0]!.id, purposes[0]!.id]])
    assert.equal(
      (
        await request(
          `consent-sandbox/sessions/${session.participant.id}/withdraw`,
          'POST',
          { version: 1, purposeIds: ids, interfaceLanguage: 'hi', idempotencyKey: randomUUID() },
          'owner',
          session.cookie,
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await admin.query('SELECT id FROM workspace.consent_receipts WHERE session_id=$1', [
        session.participant.id,
      ])
    ).rowCount,
    1,
  );
});
test('sample sessions reject changed register versions and application role cannot extend authority expiry or replace a token', async () => {
  const selected = await offer(),
    session = await start(selected);
  for (const column of ['expires_at', 'token_hash', 'actor_id'])
    await assert.rejects(
      db.transaction(tenant, (client) =>
        client.query(`UPDATE workspace.consent_participants SET ${column}=${column} WHERE id=$1`, [
          session.participant.id,
        ]),
      ),
      /permission denied/,
    );
  await admin.query('UPDATE workspace.register_entries SET version=version+1 WHERE id=$1', [
    entry.id,
  ]);
  try {
    assert.equal((await submit(session, payload(selected))).status, 409);
  } finally {
    await admin.query('UPDATE workspace.register_entries SET version=version-1 WHERE id=$1', [
      entry.id,
    ]);
  }
});
test('changed notice source blocks first submission but does not rewrite or prevent replay of a committed receipt', async () => {
  const selected = await offer(),
    unused = await start(selected),
    used = await start(selected),
    body = payload(selected);
  assert.equal((await submit(used, body)).status, 201);
  const edit = await request(`preparation/templates/${preparedTemplate.id}`, 'PUT', {
    ...template,
    body: 'Changed draft invalidates new capture',
    version: preparedTemplate.version,
    idempotencyKey: randomUUID(),
  });
  assert.equal(edit.status, 200);
  assert.equal((await submit(unused, payload(selected))).status, 409);
  assert.equal((await submit(used, body)).status, 201);
  assert.equal(
    (
      await request('consent-sandbox/offers', 'POST', {
        noticeId: notice.id,
        purposes,
        syntheticOnlyAcknowledged: true,
        idempotencyKey: randomUUID(),
      })
    ).status,
    409,
  );
});
