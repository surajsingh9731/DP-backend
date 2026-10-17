import { analyzeArchitecture, componentResources } from './source-architecture.mjs';
import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = resolve(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
const errors = [];
for (const file of files(resolve(root, 'frontend/src')).filter((p) =>
  p.endsWith('.component.ts'),
)) {
  const source = readFileSync(file, 'utf8');
  const metadata = componentResources(file, source);
  if (metadata.inline) errors.push(`Inline production template/style: ${relative(root, file)}`);
  for (const key of ['templateUrl', 'styleUrl']) {
    const path = metadata[key] ? resolve(dirname(file), metadata[key]) : null;
    if (!path || !existsSync(path) || !statSync(path).isFile())
      errors.push(`Missing external ${key}: ${relative(root, file)}`);
  }
}
for (const [folder, target] of [
  ['frontend', 'frontend/src/app/constants'],
  ['backend', 'backend/src/constants'],
]) {
  for (const file of files(resolve(root, folder, 'src')).filter((p) => p.endsWith('.constants.ts')))
    if (dirname(file) !== resolve(root, target))
      errors.push(`Constants outside dedicated folder: ${relative(root, file)}`);
}
for (const folder of ['apps', 'packages', 'ops', 'tests']) {
  try {
    statSync(resolve(root, folder));
    errors.push(`Obsolete active source folder: ${folder}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

for (const file of files(resolve(root, 'backend/src')).filter((p) => p.endsWith('.ts'))) {
  const source = readFileSync(file, 'utf8');
  const responsibilities = ['Controller', 'Injectable', 'Module', 'Entity'].filter((role) =>
    new RegExp('@' + role + '\\s*\\(').test(source),
  );
  if (responsibilities.length > 1)
    errors.push(
      `Mixed NestJS responsibilities: ${relative(root, file)} (${responsibilities.join(', ')})`,
    );
  if (/from\s+['"]pg['"]/.test(source))
    errors.push(`Direct pg import in runtime source: ${relative(root, file)}`);
  if (file.endsWith('.controller.ts') && /\.query\s*\(|getRepository\s*\(/.test(source))
    errors.push(`Persistence in controller: ${relative(root, file)}`);
}
const sources = Object.fromEntries(
  ['frontend/src', 'backend/src'].flatMap((folder) =>
    files(resolve(root, folder))
      .filter(
        (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.d.ts'),
      )
      .map((file) => [relative(root, file).replaceAll('\\', '/'), readFileSync(file, 'utf8')]),
  ),
);
const architecture = analyzeArchitecture(sources);
errors.push(...architecture.errors);
const result = {
  date: new Date().toISOString(),
  status: errors.length ? 'Failed' : 'Passed',
  checks: [
    'Separate Angular HTML and SCSS',
    'Dedicated domain-named constants folders',
    'No duplicate obsolete active roots',
    'Separate NestJS controller/service/module/entity responsibilities',
    'No direct pg runtime imports or persistence in controllers',
    'Runtime import cycle and frontend/backend dependency direction checks',
    'No Angular component HttpClient or backend compatibility-barrel dependencies',
  ],
  dependencyFiles: Object.keys(sources).length,
  dependencyEdges: architecture.edges.length,
  errors,
};
mkdirSync(resolve(root, 'docs/evidence/restructure'), { recursive: true });
writeFileSync(
  resolve(root, 'docs/evidence/restructure/structure.json'),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
