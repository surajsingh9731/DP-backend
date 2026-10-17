import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'docs/evidence/restructure');
mkdirSync(output, { recursive: true });
const checks = [
  ['source-structure', '.', ['run', 'check:structure']],
  ['frontend-format', 'frontend', ['run', 'format:check']],
  ['backend-format', 'backend', ['run', 'format:check']],
  ['backend-lint', 'backend', ['run', 'lint']],
  ['frontend-lint', 'frontend', ['run', 'lint']],
  ['backend-typecheck', 'backend', ['run', 'typecheck']],
  ['backend-build', 'backend', ['run', 'build']],
  ['frontend-build', 'frontend', ['run', 'build']],
  ['backend-unit', 'backend', ['run', 'test:unit']],
  ['backend-integration', 'backend', ['run', 'test:integration']],
  ['frontend-test', 'frontend', ['test']],
  ['backend-dependencies', 'backend', ['ls', '--depth=0']],
  ['frontend-dependencies', 'frontend', ['ls', '--depth=0']],
];
const results = [];
for (const [name, folder, args] of checks) {
  const started = new Date().toISOString();
  const result = spawnSync('npm', args, {
    cwd: resolve(root, folder),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  writeFileSync(resolve(output, `${name}.log`), result.stdout + result.stderr);
  const entry = {
    name,
    command: `cd ${folder} && npm ${args.join(' ')}`,
    status: result.status === 0 ? 'Passed' : 'Failed',
    exitCode: result.status,
    started,
    finished: new Date().toISOString(),
    evidence: `${name}.log`,
  };
  results.push(entry);
  console.log(`${name}: ${entry.status}`);
}
writeFileSync(
  resolve(output, 'checks.json'),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      scope:
        'UX4G phase 1: pinned scoped font-adapted CSS, native Angular primitives, bilingual landing, workspace shell and sign-in actions; complete regression including preserved in-progress retention backend',
      node: process.version,
      checks: results,
    },
    null,
    2,
  ) + '\n',
);
if (results.some((row) => row.status === 'Failed')) process.exitCode = 1;
