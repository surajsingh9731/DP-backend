import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { migrate, revertMigrations } from './migrate.mjs';
const root = resolve(import.meta.dirname, '../..');
const config = JSON.parse(readFileSync(resolve(root, '.local/runtime.json'), 'utf8'));
const admin = new pg.Client({
  connectionString: config.adminUrl.replace('/sahmati_local', '/postgres'),
});
await admin.connect();
try {
  const old = await admin.query(
    "SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname='sahmati_test'",
  );
  if (old.rowCount) {
    if (old.rows[0].marker !== 'Sahmati disposable automated test database')
      throw new Error('Existing test database is not marked as disposable; refusing reset.');
    await admin.query('DROP DATABASE sahmati_test WITH (FORCE)');
  }
  await admin.query('CREATE DATABASE sahmati_test');
  await admin.query(
    "COMMENT ON DATABASE sahmati_test IS 'Sahmati disposable automated test database'",
  );
} finally {
  await admin.end();
}
const test = { ...config };
for (const key of ['adminUrl', 'appUrl', 'workerUrl'])
  test[key] = config[key].replace('/sahmati_local', '/sahmati_test');
writeFileSync(resolve(root, '.local/test-runtime.json'), JSON.stringify(test, null, 2), {
  mode: 0o600,
});
await migrate(test.adminUrl);
await migrate(test.adminUrl);
// Checksum verification must also run when TypeORM has no pending migrations.
const checksumClient = new pg.Client({ connectionString: test.adminUrl });
await checksumClient.connect();
let savedChecksum;
try {
  const row = await checksumClient.query(
    'SELECT name,checksum FROM public.schema_migrations ORDER BY name LIMIT 1',
  );
  savedChecksum = row.rows[0];
  await checksumClient.query('UPDATE public.schema_migrations SET checksum=$2 WHERE name=$1', [
    savedChecksum.name,
    'tampered-test-checksum',
  ]);
  let rejected = false;
  try {
    await migrate(test.adminUrl);
  } catch (error) {
    if (!String(error).includes('Applied migration changed')) throw error;
    rejected = true;
  }
  if (!rejected) throw new Error('Applied checksum tampering was not rejected');
} finally {
  if (savedChecksum)
    await checksumClient.query('UPDATE public.schema_migrations SET checksum=$2 WHERE name=$1', [
      savedChecksum.name,
      savedChecksum.checksum,
    ]);
  await checksumClient.end();
}
// Simulate legacy-only history after an already-created schema. Adoption must not replay SQL.
const legacy = new pg.Client({ connectionString: test.adminUrl });
await legacy.connect();
try {
  await legacy.query('DROP TABLE public.typeorm_migrations');
  const before = await legacy.query(
    'SELECT name,checksum,applied_at FROM public.schema_migrations ORDER BY name',
  );
  await migrate(test.adminUrl);
  const after = await legacy.query(
    'SELECT name,checksum,applied_at FROM public.schema_migrations ORDER BY name',
  );
  if (JSON.stringify(before.rows) !== JSON.stringify(after.rows))
    throw new Error('Legacy adoption changed migration history');
  const counts = await legacy.query('SELECT count(*)::int AS total FROM public.typeorm_migrations');
  if (counts.rows[0].total !== before.rowCount)
    throw new Error('TypeORM legacy adoption incomplete');
} finally {
  await legacy.end();
}
await revertMigrations(test.adminUrl);
await migrate(test.adminUrl);
const seed = spawnSync(process.execPath, ['backend/scripts/seed.mjs'], {
  cwd: root,
  env: { ...process.env, SAHMATI_RUNTIME: '.local/test-runtime.json' },
  stdio: 'inherit',
});
if (seed.status !== 0) process.exit(seed.status ?? 1);
console.log(
  'Disposable test database prepared; fresh, repeated, legacy adoption and TypeORM down/up migration paths passed.',
);
