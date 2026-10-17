import 'reflect-metadata';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { sqlMigration } from './sql-migration.ts';
const root = resolve(import.meta.dirname, '../..');
const config = JSON.parse(readFileSync(resolve(root, '.local/runtime.json'), 'utf8'));
const dir = resolve(root, 'backend/database/migrations');
const files = () =>
  readdirSync(dir)
    .filter((n) => n.endsWith('.up.sql'))
    .sort();
export async function migrationSource(connectionString = config.adminUrl) {
  const source = new DataSource({
    type: 'postgres',
    url: connectionString,
    synchronize: false,
    dropSchema: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migrations',
    migrations: files().map((name, index) =>
      sqlMigration(name, resolve(dir, name), 1700000000000 + index),
    ),
    logging: false,
  });
  await source.initialize();
  return source;
}
export async function migrate(connectionString = config.adminUrl) {
  const source = await migrationSource(connectionString);
  const lock = source.createQueryRunner();
  try {
    await lock.connect();
    await lock.query('SELECT pg_advisory_lock(731991)');
    await lock.query(
      'CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const history = await lock.query('SELECT name,checksum FROM public.schema_migrations');
    // Validate even migrations already recorded by TypeORM, not just pending migrations.
    for (const record of history) {
      if (!files().includes(record.name))
        throw new Error(`Unknown applied migration: ${record.name}`);
      const checksum = createHash('sha256')
        .update(readFileSync(resolve(dir, record.name), 'utf8'))
        .digest('hex');
      if (record.checksum !== checksum)
        throw new Error(`Applied migration changed: ${record.name}`);
    }
    const ormTable = await lock.query("SELECT to_regclass('public.typeorm_migrations') AS name");
    if (ormTable[0]?.name) {
      const recorded = await lock.query('SELECT name FROM public.typeorm_migrations');
      for (const migration of recorded) {
        const index = files().findIndex(
          (_name, index) => `SahmatiSql${1700000000000 + index}` === migration.name,
        );
        if (index < 0 || !history.some((record) => record.name === files()[index]))
          throw new Error(
            `TypeORM migration history has no matching verified SQL history: ${migration.name}`,
          );
      }
    }
    const applied = await source.runMigrations({ transaction: 'all' });
    console.log(
      `TypeORM migration runner checked ${files().length} SQL migrations; ${applied.length} applied or safely adopted.`,
    );
  } finally {
    try {
      await lock.query('SELECT pg_advisory_unlock(731991)');
    } finally {
      await lock.release();
      await source.destroy();
    }
  }
}
export async function revertMigrations(connectionString) {
  const url = new URL(connectionString);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/sahmati_test')
    throw new Error('Down migrations only allowed on isolated disposable test database');
  const source = await migrationSource(connectionString);
  try {
    const marker = await source.query(
      "SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()",
    );
    if (marker[0]?.marker !== 'Sahmati disposable automated test database')
      throw new Error('Test database marker required');
    for (let index = 0; index < files().length; index++)
      await source.undoLastMigration({ transaction: 'all' });
  } finally {
    await source.destroy();
  }
}
if (process.argv[1] === new URL(import.meta.url).pathname) await migrate();
