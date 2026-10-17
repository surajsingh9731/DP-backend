#!/usr/bin/env node
// Creates the local PostgreSQL database for Sahmati if it doesn't already
// exist. Safe to re-run: it inspects first and never drops anything.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');
if (!existsSync(envPath)) {
  console.error('No .env found. Copy .env.example to .env and fill in your own values first.');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE } = env;
if (!DB_HOST || !DB_PORT || !DB_USERNAME || !DB_PASSWORD || !DB_DATABASE) {
  console.error('DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE must all be set in .env');
  process.exit(1);
}

const psqlEnv = { ...process.env, PGPASSWORD: DB_PASSWORD };
const psqlBase = `psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USERNAME} -d postgres -tAc`;

const exists = execSync(`${psqlBase} "SELECT 1 FROM pg_database WHERE datname='${DB_DATABASE}'"`, {
  env: psqlEnv,
})
  .toString()
  .trim();

if (exists === '1') {
  console.log(`Database "${DB_DATABASE}" already exists — nothing to do.`);
} else {
  execSync(`psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USERNAME} -d postgres -c "CREATE DATABASE \\"${DB_DATABASE}\\""`, {
    env: psqlEnv,
    stdio: 'inherit',
  });
  console.log(`Created database "${DB_DATABASE}".`);
}

console.log('Next: npm run db:migrate && npm run db:seed');
