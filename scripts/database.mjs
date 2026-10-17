import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';
const root = resolve(import.meta.dirname, '../..');
const local = resolve(root, '.local');
const data = resolve(local, 'pgdata');
const configPath = resolve(local, 'runtime.json');
const bin = process.env.SAHMATI_PG_BIN || '/usr/lib/postgresql/18/bin';
const run = (name, args) => {
  const result = spawnSync(resolve(bin, name), args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${name} failed: ${result.stderr || result.stdout}`);
};
if (process.argv[2] === 'stop') {
  if (existsSync(resolve(data, 'postmaster.pid')))
    run('pg_ctl', ['-D', data, 'stop', '-m', 'fast']);
  console.log('Project PostgreSQL stopped.');
  process.exit(0);
}
mkdirSync(local, { recursive: true, mode: 0o700 });
mkdirSync(resolve(local, 'socket'), { recursive: true, mode: 0o700 });
let config;
if (!existsSync(configPath)) {
  if (existsSync(resolve(data, 'PG_VERSION')))
    throw new Error('Existing cluster without runtime config; refusing to reset credentials.');
  const admin = randomBytes(24).toString('hex');
  const app = randomBytes(24).toString('hex');
  const worker = randomBytes(24).toString('hex');
  const pwfile = resolve(local, 'init-password');
  writeFileSync(pwfile, admin, { mode: 0o600 });
  try {
    run('initdb', [
      '-D',
      data,
      '-U',
      'sahmati_admin',
      '--auth-local=scram-sha-256',
      '--auth-host=scram-sha-256',
      '--pwfile',
      pwfile,
      '--encoding=UTF8',
      '--no-locale',
    ]);
  } finally {
    rmSync(pwfile, { force: true });
  }
  config = {
    mode: 'local',
    host: '127.0.0.1',
    apiPort: 4300,
    webOrigin: 'http://127.0.0.1:4200',
    adminUrl: `postgresql://sahmati_admin:${admin}@127.0.0.1:55432/sahmati_local`,
    appUrl: `postgresql://sahmati_app:${app}@127.0.0.1:55432/sahmati_local`,
    workerUrl: `postgresql://sahmati_worker:${worker}@127.0.0.1:55432/sahmati_local`,
    authPepper: randomBytes(32).toString('hex'),
    mailTransport: 'database-sink',
    pollMs: 700,
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
} else config = JSON.parse(readFileSync(configPath, 'utf8'));
if (!existsSync(resolve(data, 'postmaster.pid'))) {
  run('pg_ctl', [
    '-D',
    data,
    '-l',
    resolve(local, 'postgres.log'),
    '-o',
    `-h 127.0.0.1 -p 55432 -k ${resolve(local, 'socket')} -c unix_socket_permissions=0700`,
    'start',
  ]);
}
const admin = new pg.Client({
  connectionString: config.adminUrl.replace('/sahmati_local', '/postgres'),
});
await admin.connect();
try {
  for (const [role, url] of [
    ['sahmati_app', config.appUrl],
    ['sahmati_worker', config.workerUrl],
  ]) {
    const found = await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
    if (!found.rowCount) {
      const password = new URL(url).password;
      if (!/^[a-f0-9]{48}$/.test(password)) throw new Error('Invalid local credential format');
      await admin.query(
        `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${password}'`,
      );
    }
  }
  if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='sahmati_local'")).rowCount) {
    await admin.query('CREATE DATABASE sahmati_local');
  }
} finally {
  await admin.end();
}
console.log(
  'Isolated project PostgreSQL ready on 127.0.0.1:55432. Credentials remain in .local/runtime.json.',
);
