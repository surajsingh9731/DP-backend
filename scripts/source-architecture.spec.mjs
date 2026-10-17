import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeArchitecture, componentResources } from './source-architecture.mjs';

test('architecture permits owning-module imports, shared contracts and type-only cycles', () => {
  const { errors } = analyzeArchitecture({
    'backend/src/auth/auth.service.ts':
      "import { Database } from '../database/database.service.js'; import type { Scope } from '@sahmati/contracts';",
    'backend/src/database/database.service.ts':
      "import type { AuthService } from '../auth/auth.service.js';",
    'backend/src/local/local.repository.ts':
      "import { Database } from '../database/database.service.js';",
    'backend/src/types-one.ts': "export { type Value } from './types-two.js';",
    'backend/src/types-two.ts': "import { type Value } from './types-one.js';",
    'frontend/src/app/core/api.service.ts': "import type { Scope } from '@sahmati/contracts';",
  });
  assert.deepEqual(errors, []);
});
test('architecture rejects runtime cycles including lazy imports and re-exports', () => {
  const { errors } = analyzeArchitecture({
    'backend/src/a.ts': "export { value } from './b.js';",
    'backend/src/b.ts': "const load = () => import('./a.js');",
  });
  assert.ok(errors.some((error) => error.startsWith('Runtime import cycle:')));
});
test('architecture rejects frontend upward, sibling and cross-package source dependencies', () => {
  const { errors } = analyzeArchitecture({
    'frontend/src/app/core/api.ts': "import { Page } from '../features/login/page';",
    'frontend/src/app/features/login/page.ts':
      "import { Page } from '../register/page'; import type { Secret } from '../../../../../backend/src/config/private';",
    'frontend/src/app/features/register/page.ts': '',
  });
  assert.ok(errors.some((error) => error.startsWith('Frontend core depends')));
  assert.ok(errors.some((error) => error.startsWith('Frontend feature imports')));
  assert.ok(errors.some((error) => error.startsWith('Cross-package source import')));
});
test('architecture rejects persistence in transport and backwards repository dependencies', () => {
  const { errors } = analyzeArchitecture({
    'backend/src/register/register.controller.ts':
      "import { Repository } from './register.repository.js';",
    'backend/src/register/register.repository.ts':
      "import { Service } from './register.service.js';",
    'backend/src/register/register.service.ts': '',
    'backend/src/constants/policy.constants.ts':
      "import { Service } from '../register/register.service.js';",
  });
  assert.ok(errors.some((error) => error.startsWith('Controller depends')));
  assert.ok(errors.some((error) => error.startsWith('Repository depends')));
  assert.ok(errors.some((error) => error.startsWith('Constants depend on runtime')));
});
test('architecture rejects implementation imports through compatibility barrels', () => {
  const { errors } = analyzeArchitecture({
    'backend/src/auth/auth.service.ts': "import { Database } from '../api/database.js';",
    'backend/src/api/database.ts': '',
  });
  assert.ok(errors.some((error) => error.startsWith('Backend implementation imports')));
});
test('architecture rejects aliased HttpClient in Angular components', () => {
  const { errors } = analyzeArchitecture({
    'frontend/src/app/features/login/login.component.ts':
      "import { HttpClient as Client } from '@angular/common/http';",
  });
  assert.ok(errors.some((error) => error.startsWith('Angular component imports HttpClient')));
});

test('component metadata ignores a template-named form used in a ternary', () => {
  assert.deepEqual(
    componentResources(
      'sample.component.ts',
      "@Component({templateUrl: './sample.html', styleUrl: './sample.scss'}) class Page { form() { return ready ? this.template : this.contact; } }",
    ),
    { inline: false, templateUrl: './sample.html', styleUrl: './sample.scss' },
  );
});
test('component metadata detects actual inline Angular resources', () => {
  assert.equal(
    componentResources(
      'sample.component.ts',
      "@Component({template: '<p>Inline</p>', styles: ['p {}']}) class Page {}",
    ).inline,
    true,
  );
});
