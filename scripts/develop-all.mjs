import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const pidFile = resolve(root, '.local/dev.pid');
if (process.argv.includes('--stop')) {
  if (!existsSync(pidFile)) {
    console.log('No project development supervisor is recorded.');
    process.exit(0);
  }
  const pid = Number(readFileSync(pidFile, 'utf8'));
  try {
    const command = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    if (!command.includes('backend/scripts/develop-all.mjs'))
      throw new Error('Recorded PID does not belong to the project supervisor.');
    process.kill(pid, 'SIGTERM');
    console.log('Requested project API, worker and web shutdown.');
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error;
    rmSync(pidFile, { force: true });
  }
  process.exit(0);
}
if (existsSync(pidFile)) {
  const previous = Number(readFileSync(pidFile, 'utf8'));
  try {
    process.kill(previous, 0);
    throw new Error('Project development supervisor is already running.');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}
writeFileSync(pidFile, String(process.pid), { mode: 0o600 });
const children = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}
for (const [folder, args] of [
  ['backend', ['dist/src/api/main.js']],
  ['backend', ['dist/src/worker/main.js']],
  [
    'frontend',
    [
      'node_modules/@angular/cli/bin/ng.js',
      'serve',
      'web',
      '--host',
      '127.0.0.1',
      '--port',
      '4200',
      '--proxy-config',
      'proxy.conf.json',
    ],
  ],
]) {
  const child = spawn(process.execPath, args, {
    cwd: resolve(root, folder),
    stdio: 'inherit',
    env: process.env,
  });
  children.push(child);
  child.on('exit', (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', () => {
  if (existsSync(pidFile) && readFileSync(pidFile, 'utf8') === String(process.pid))
    rmSync(pidFile, { force: true });
});
