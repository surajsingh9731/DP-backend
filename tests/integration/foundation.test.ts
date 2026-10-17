import { WorkerRepository } from '../../src/worker/worker.repository.js';
import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { typeormConfig } from '../../src/database/typeorm.config.js';
import { databaseClient } from '../../src/database/database-client.js';
import { createApp } from '../../src/api/app.js';
import { loadConfig } from '../../src/api/config.js';
import { Database } from '../../src/api/database.js';
import { DeliveryWorker } from '../../src/worker/worker.js';
import { DatabaseSink } from '../../src/worker/channel.js';
import { eventDigest } from '../../src/api/workspace.js';
import type { MailView, SessionView, TaskView, WorkspaceView } from '@sahmati/contracts';
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222';
const staffId = '00000000-0000-4000-8000-000000000002';
const config = loadConfig();
const admin = new Pool({ connectionString: config.adminUrl });
let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
let workerDb: Database;
let workerDataSource: DataSource;
let worker: DeliveryWorker;
let appDb: Database;
const cookies: Record<string, string> = {};
let task: TaskView;
let ownerChallenge: string;
let ownerCode: string;
async function request(path: string, method = 'GET', cookie?: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function login(account: string): Promise<string> {
  const reply = await request('/auth/challenges', 'POST', undefined, {
    email: `${account}@demo.sahmati.test`,
  });
  assert.equal(reply.status, 202);
  const { challengeId } = (await reply.json()) as { challengeId: string };
  await worker.tick();
  const inbox = (await (await request('/dev/mail')).json()) as MailView[];
  const message = inbox.find((m) => m.id === challengeId);
  assert.ok(message);
  const code = message.body.match(/\b\d{6}\b/)?.[0];
  assert.ok(code);
  const verified = await request('/auth/verify', 'POST', undefined, { challengeId, code });
  assert.equal(verified.status, 200);
  const cookie = verified.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  if (account === 'owner') {
    ownerChallenge = challengeId;
    ownerCode = code;
  }
  return cookie;
}
before(async () => {
  app = await createApp(true);
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api`;
  appDb = app.get(Database);
  process.env['SAHMATI_PROCESS_KIND'] = 'worker';
  workerDataSource = await new DataSource(
    typeormConfig(new ConfigService(config)) as DataSourceOptions,
  ).initialize();
  workerDb = new Database(workerDataSource);
  delete process.env['SAHMATI_PROCESS_KIND'];
  worker = new DeliveryWorker(workerDb, new DatabaseSink(), new WorkerRepository());
  for (const account of ['owner', 'staff', 'viewer', 'other', 'operator'])
    cookies[account] = await login(account);
});
after(async () => {
  await app?.close();
  if (workerDataSource?.isInitialized) await workerDataSource.destroy();
  await admin.end();
});
test('local API reports readiness and never sets browser cacheable personal responses', async () => {
  const result = await request('/health/ready');
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.ok(result.headers.get('x-request-id'));
  assert.equal((await request(`/tenants/${A}/summary`)).status, 401);
});
test('session membership excludes other tenants and platform operators get no tenant access', async () => {
  const me = (await (await request('/auth/me', 'GET', cookies['owner'])).json()) as SessionView;
  assert.deepEqual(
    me.memberships.map((m) => m.tenantId),
    [A],
  );
  assert.equal((await request(`/tenants/${B}/summary`, 'GET', cookies['owner'])).status, 403);
  const operator = (await (
    await request('/auth/me', 'GET', cookies['operator'])
  ).json()) as SessionView;
  assert.equal(operator.memberships.length, 0);
  assert.equal((await request(`/tenants/${A}/summary`, 'GET', cookies['operator'])).status, 403);
});
test('validation, role guards and cross-site protection reject unauthorised mutations', async () => {
  const body = { template: 'review_inventory', idempotencyKey: randomUUID() };
  for (const role of ['staff', 'viewer'])
    assert.equal((await request(`/tenants/${A}/tasks`, 'POST', cookies[role], body)).status, 403);
  assert.equal(
    (await request(`/tenants/${A}/tasks`, 'POST', cookies['owner'], { ...body, tenantId: B }))
      .status,
    400,
  );
  const cross = await fetch(`${base}/tenants/${A}/tasks`, {
    method: 'POST',
    headers: {
      cookie: cookies['owner']!,
      'Content-Type': 'application/json',
      Origin: 'https://untrusted.example',
    },
    body: JSON.stringify(body),
  });
  assert.equal(cross.status, 403);
});
test('concurrent retries commit exactly one task, evidence event and notification intent', async () => {
  const key = randomUUID();
  const body = { template: 'review_inventory', idempotencyKey: key };
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => request(`/tenants/${A}/tasks`, 'POST', cookies['owner'], body)),
  );
  for (const res of responses) assert.equal(res.status, 201);
  const tasks = await Promise.all(responses.map((res) => res.json() as Promise<TaskView>));
  assert.equal(new Set(tasks.map((t) => t.id)).size, 1);
  task = tasks[0]!;
  const rows = await admin.query(
    'SELECT (SELECT count(*) FROM workspace.tasks WHERE tenant_id=$1 AND idempotency_key=$2)::int AS tasks,(SELECT count(*) FROM workspace.evidence WHERE tenant_id=$1 AND task_id=$3)::int AS events,(SELECT count(*) FROM workspace.outbox WHERE tenant_id=$1 AND task_id=$3)::int AS messages',
    [A, key, task.id],
  );
  assert.deepEqual(rows.rows[0], { tasks: 1, events: 1, messages: 1 });
});
test('outbox persistence failure rolls back the task and evidence together', async () => {
  const key = randomUUID();
  const before = Number(
    (await admin.query('SELECT count(*) FROM workspace.evidence')).rows[0].count,
  );
  await admin.query(
    "CREATE FUNCTION workspace.test_fail_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER test_outbox_failure BEFORE INSERT ON workspace.outbox FOR EACH ROW EXECUTE FUNCTION workspace.test_fail_outbox()",
  );
  try {
    const result = await request(`/tenants/${A}/tasks`, 'POST', cookies['owner'], {
      template: 'review_inventory',
      idempotencyKey: key,
    });
    assert.equal(result.status, 500);
    const error = (await result.json()) as { message: string };
    assert.equal(error.message.includes('test failure'), false);
    assert.equal(
      (await admin.query('SELECT 1 FROM workspace.tasks WHERE idempotency_key=$1', [key])).rowCount,
      0,
    );
    assert.equal(
      Number((await admin.query('SELECT count(*) FROM workspace.evidence')).rows[0].count),
      before,
    );
  } finally {
    await admin.query(
      'DROP TRIGGER test_outbox_failure ON workspace.outbox; DROP FUNCTION workspace.test_fail_outbox()',
    );
  }
});
test('RLS denies missing context, forged cross-tenant writes, joins and context reuse leaks', async () => {
  const runner = appDb.dataSource.createQueryRunner();
  await runner.connect();
  const client = databaseClient(runner);
  try {
    assert.equal((await client.query('SELECT id FROM workspace.tasks')).rowCount, 0);
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id',$1,true)", [A]);
    assert.equal(
      (
        await client.query(
          'SELECT t.id FROM workspace.tasks t JOIN workspace.organisations o ON o.id=t.tenant_id WHERE t.id=$1',
          [task.id],
        )
      ).rowCount,
      1,
    );
    await client.query('COMMIT');
    assert.equal((await client.query('SELECT id FROM workspace.tasks')).rowCount, 0);
  } finally {
    await runner.release();
  }
  await assert.rejects(
    appDb.transaction(B, (client) =>
      client.query(
        'INSERT INTO workspace.tasks(tenant_id,id,branch_id,assignee_id,template,idempotency_key) VALUES($1,$2,$3,$4,$5,$6)',
        [
          A,
          randomUUID(),
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          staffId,
          'review_inventory',
          randomUUID(),
        ],
      ),
    ),
    /row-level security/,
  );
  await assert.rejects(
    appDb.transaction(A, (client) =>
      client.query("UPDATE workspace.evidence SET action='task.closed'"),
    ),
    /permission denied/,
  );
  const role = await admin.query(
    "SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('sahmati_app','sahmati_worker')",
  );
  assert.ok(role.rows.every((r) => !r.rolsuper && !r.rolbypassrls));
});
test('interrupted worker lease recovers and stale/duplicate deliveries cannot duplicate local mail', async () => {
  const claim = await worker.claim(A);
  assert.ok(claim);
  await admin.query(
    "UPDATE workspace.outbox SET lease_until=now()-interval '1 second' WHERE id=$1",
    [claim.id],
  );
  const recovered = await worker.claim(A);
  assert.ok(recovered);
  assert.notEqual(recovered.lease, claim.lease);
  assert.equal(recovered.attempts, 2);
  await worker.deliver(claim);
  assert.equal(
    (await admin.query('SELECT 1 FROM delivery.mailbox WHERE message_id=$1', [claim.id])).rowCount,
    0,
  );
  await worker.deliver(recovered);
  await worker.deliver(recovered);
  assert.equal(
    (await admin.query('SELECT 1 FROM delivery.mailbox WHERE message_id=$1', [claim.id])).rowCount,
    1,
  );
});
test('staff can review assigned work; stale versions and viewer edits fail; replay creates no extra event', async () => {
  assert.equal(
    (
      await request(`/tenants/${A}/tasks/${task.id}/close`, 'POST', cookies['viewer'], {
        version: task.version,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/tenants/${A}/tasks/${task.id}/close`, 'POST', cookies['staff'], {
        version: 99,
      })
    ).status,
    409,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await request(`/tenants/${A}/tasks/${task.id}/close`, 'POST', cookies['staff'], {
          version: task.version,
        })
      ).status,
      201,
    );
  assert.equal(
    Number(
      (
        await admin.query(
          "SELECT count(*) FROM workspace.evidence WHERE task_id=$1 AND action='task.closed'",
          [task.id],
        )
      ).rows[0].count,
    ),
    1,
  );
  const view = (await (
    await request(`/tenants/${A}/summary`, 'GET', cookies['viewer'])
  ).json()) as WorkspaceView;
  assert.equal(view.tasks[0]?.status, 'closed');
});
test('closing a task before delayed delivery cancels its pending notification', async () => {
  const res = await request(`/tenants/${A}/tasks`, 'POST', cookies['owner'], {
    template: 'review_inventory',
    idempotencyKey: randomUUID(),
  });
  const next = (await res.json()) as TaskView;
  await request(`/tenants/${A}/tasks/${next.id}/close`, 'POST', cookies['owner'], {
    version: next.version,
  });
  const claim = await worker.claim(A);
  assert.ok(claim);
  await worker.deliver(claim);
  assert.equal(
    (await admin.query('SELECT status FROM workspace.outbox WHERE id=$1', [claim.id])).rows[0]
      .status,
    'cancelled',
  );
});
test('delivery failures stop after bounded retries and expose failure instead of success', async () => {
  await request(`/tenants/${A}/tasks`, 'POST', cookies['owner'], {
    template: 'review_inventory',
    idempotencyKey: randomUUID(),
  });
  const failing = new DeliveryWorker(
    workerDb,
    {
      async deliver() {
        throw new Error('simulated unavailable sink');
      },
    },
    new WorkerRepository(),
  );
  let id = '';
  for (let i = 0; i < 3; i++) {
    const claim = await failing.claim(A);
    assert.ok(claim);
    id = claim.id;
    await failing.deliver(claim);
    await admin.query('UPDATE workspace.outbox SET available_at=now() WHERE id=$1', [id]);
  }
  const row = (await admin.query('SELECT status,attempts FROM workspace.outbox WHERE id=$1', [id]))
    .rows[0];
  assert.deepEqual(row, { status: 'failed', attempts: 3 });
  assert.equal(
    (await admin.query('SELECT 1 FROM delivery.mailbox WHERE message_id=$1', [id])).rowCount,
    0,
  );
  assert.equal(await worker.claim(A), null);
});
test('evidence hash chain is reproducible and contains identifiers rather than personal payloads', async () => {
  const rows = await admin.query(
    'SELECT * FROM workspace.evidence WHERE tenant_id=$1 ORDER BY sequence',
    [A],
  );
  let previousHash = 'genesis';
  let sequence = 0;
  for (const e of rows.rows) {
    sequence++;
    assert.equal(e.previous_hash, previousHash);
    assert.equal(Number(e.sequence), sequence);
    const expected = eventDigest({
      id: e.id,
      tenantId: e.tenant_id,
      sequence,
      taskId: e.task_id,
      actorId: e.actor_id,
      action: e.action,
      previousHash,
      occurredAt: e.occurred_at.toISOString(),
    });
    assert.equal(e.event_hash, expected);
    previousHash = e.event_hash;
  }
});
test('Hindi message intents preserve template version and language through the local channel', async () => {
  const challenge = (await (
    await request('/auth/challenges', 'POST', undefined, {
      email: 'staff@demo.sahmati.test',
      language: 'hi',
    })
  ).json()) as { challengeId: string };
  await worker.tick();
  const login = (
    await admin.query(
      'SELECT language,template_key,template_version,subject FROM delivery.mailbox WHERE message_id=$1',
      [challenge.challengeId],
    )
  ).rows[0];
  assert.equal(login.language, 'hi');
  assert.equal(login.template_key, 'login_code');
  assert.equal(login.template_version, 1);
  assert.ok(login.subject.includes('सहमति'));
  const response = await request(`/tenants/${A}/tasks`, 'POST', cookies['owner'], {
    template: 'review_inventory',
    idempotencyKey: randomUUID(),
    language: 'hi',
  });
  assert.equal(response.status, 201);
  const created = (await response.json()) as TaskView;
  await worker.tick();
  const notification = (
    await admin.query(
      'SELECT m.language,m.template_key,m.template_version,m.subject FROM delivery.mailbox m JOIN workspace.outbox o ON o.id=m.message_id WHERE o.task_id=$1',
      [created.id],
    )
  ).rows[0];
  assert.equal(notification.language, 'hi');
  assert.equal(notification.template_key, 'setup_task_assigned');
  assert.equal(notification.template_version, 1);
  assert.ok(notification.subject.includes('सहमति'));
});
test('wrong-code attempts persist, expired codes and consumed code replay are rejected', async () => {
  assert.equal(
    (
      await request('/auth/verify', 'POST', undefined, {
        challengeId: ownerChallenge,
        code: ownerCode,
      })
    ).status,
    401,
  );
  const result = (await (
    await request('/auth/challenges', 'POST', undefined, { email: 'owner@demo.sahmati.test' })
  ).json()) as { challengeId: string };
  await worker.tick();
  const message = ((await (await request('/dev/mail')).json()) as MailView[]).find(
    (m) => m.id === result.challengeId,
  );
  assert.ok(message);
  const good = message.body.match(/\b\d{6}\b/)![0];
  const bad = good === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await request('/auth/verify', 'POST', undefined, {
          challengeId: result.challengeId,
          code: bad,
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await request('/auth/verify', 'POST', undefined, {
        challengeId: result.challengeId,
        code: good,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await admin.query('SELECT attempts FROM identity.challenges WHERE id=$1', [
        result.challengeId,
      ])
    ).rows[0].attempts,
    5,
  );
  const expired = (await (
    await request('/auth/challenges', 'POST', undefined, { email: 'owner@demo.sahmati.test' })
  ).json()) as { challengeId: string };
  await admin.query(
    "UPDATE identity.challenges SET expires_at=now()-interval '1 second' WHERE id=$1",
    [expired.challengeId],
  );
  assert.equal(
    (
      await request('/auth/verify', 'POST', undefined, {
        challengeId: expired.challengeId,
        code: '123456',
      })
    ).status,
    401,
  );
});
test('request throttling and unknown accounts have generic responses and no extra delivery', async () => {
  for (const email of ['owner@demo.sahmati.test', 'unknown@example.test']) {
    const res = await request('/auth/challenges', 'POST', undefined, { email });
    assert.equal(res.status, 202);
    const body = (await res.json()) as { challengeId: string; message: string };
    assert.equal(
      body.message,
      'If this local test account is available, a code will appear in the local mailbox.',
    );
    assert.equal(
      (await admin.query('SELECT 1 FROM delivery.login_jobs WHERE id=$1', [body.challengeId]))
        .rowCount,
      0,
    );
  }
});
test('membership revocation takes effect immediately; logout revokes the session server-side', async () => {
  await admin.query('UPDATE identity.memberships SET active=false WHERE user_id=$1', [staffId]);
  assert.equal((await request(`/tenants/${A}/summary`, 'GET', cookies['staff'])).status, 403);
  await admin.query('UPDATE identity.memberships SET active=true WHERE user_id=$1', [staffId]);
  assert.equal((await request('/auth/logout', 'POST', cookies['owner'], {})).status, 200);
  assert.equal((await request('/auth/me', 'GET', cookies['owner'])).status, 401);
});

test('localhost browser login origin works while foreign origins and cross-site requests remain denied', async () => {
  for (const [origin, expected, site] of [
    ['http://localhost:4200', 202, 'same-origin'],
    ['http://127.0.0.1:4200', 202, 'same-origin'],
    ['http://localhost:4201', 403, 'same-origin'],
    ['https://untrusted.example', 403, 'cross-site'],
    ['http://localhost:4200', 403, 'cross-site'],
  ] as const) {
    const result = await fetch(`${base}/auth/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, 'Sec-Fetch-Site': site },
      body: JSON.stringify({ email: 'no-account@demo.sahmati.test' }),
    });
    assert.equal(result.status, expected, origin + '/' + site);
  }
});
