import { WorkerRepository } from '../../src/worker/worker.repository.js';
import 'reflect-metadata';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';
import { loadConfig } from '../../src/api/config.js';
import { Database } from '../../src/api/database.js';
import {
  DATABASE_ENTITIES,
  RegisterEntryEntity,
  RegisterRevisionEntity,
  SetupDraftEntity,
} from '../../src/database/entities/index.js';
const tenant = '11111111-1111-4111-8111-111111111111';
let source: DataSource, db: Database;
before(async () => {
  source = await new DataSource({
    type: 'postgres',
    url: loadConfig().appUrl,
    entities: DATABASE_ENTITIES,
    synchronize: false,
    dropSchema: false,
    extra: { max: 1 },
  }).initialize();
  db = new Database(source);
});
after(async () => {
  if (source?.isInitialized) await source.destroy();
});
test('TypeORM builds mapped entity metadata without automatic schema synchronization', () => {
  assert.equal(source.options.synchronize, false);
  assert.equal(source.getMetadata(RegisterEntryEntity).tablePath, 'workspace.register_entries');
  assert.equal(
    source.getMetadata(RegisterEntryEntity).findColumnWithPropertyName('tenantId')?.databaseName,
    'tenant_id',
  );
  assert.deepEqual(
    source.getMetadata(RegisterRevisionEntity).primaryColumns.map((column) => column.propertyName),
    ['tenantId', 'entryId', 'version'],
  );
  assert.equal(
    source.getMetadata(SetupDraftEntity).findColumnWithPropertyName('registerEntryId')?.isNullable,
    true,
  );
});
test('QueryRunner clears tenant context on commit and rollback before connection reuse', async () => {
  await db.transaction(tenant, async (client) => {
    assert.ok(client.manager.queryRunner);
    assert.equal(
      (
        await client.query<{ value: string }>(
          "SELECT current_setting('app.tenant_id',true) AS value",
        )
      ).rows[0]?.value,
      tenant,
    );
    assert.equal(
      await client.manager.getRepository(RegisterEntryEntity).count(),
      (await client.query('SELECT id FROM workspace.register_entries')).rowCount,
    );
  });
  assert.equal(
    (
      await db.query<{ value: string }>(
        "SELECT nullif(current_setting('app.tenant_id',true),'') AS value",
      )
    ).rows[0]?.value,
    null,
  );
  await assert.rejects(
    db.transaction(tenant, async () => {
      throw new Error('forced rollback');
    }),
    /forced rollback/,
  );
  assert.equal((await db.query('SELECT id FROM workspace.register_entries')).rowCount, 0);
  assert.equal(
    (
      await db.query<{ value: string }>(
        "SELECT nullif(current_setting('app.tenant_id',true),'') AS value",
      )
    ).rows[0]?.value,
    null,
  );
});

test('restricted worker heartbeat upsert remains a single operational row through TypeORM QueryRunner', async () => {
  const workerSource = await new DataSource({
    type: 'postgres',
    url: loadConfig().workerUrl,
    synchronize: false,
    dropSchema: false,
  }).initialize();
  try {
    const workerDb = new Database(workerSource),
      repository = new WorkerRepository();
    await workerDb.transaction(null, (client) => repository.heartbeat(client));
    const initial = await workerDb.query<{ singleton: boolean; last_seen_at: Date }>(
      'SELECT singleton,last_seen_at FROM delivery.worker_heartbeat',
    );
    assert.equal(initial.rowCount, 1);
    assert.equal(initial.rows[0]?.singleton, true);
    assert.ok(initial.rows[0]?.last_seen_at instanceof Date);
    await workerDb.transaction(null, (client) => repository.heartbeat(client));
    const repeated = await workerDb.query<{ last_seen_at: Date }>(
      'SELECT last_seen_at FROM delivery.worker_heartbeat',
    );
    assert.equal(repeated.rowCount, 1);
    assert.ok(repeated.rows[0]!.last_seen_at >= initial.rows[0]!.last_seen_at);
  } finally {
    await workerSource.destroy();
  }
});
