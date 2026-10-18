import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import security from 'eslint-plugin-security';
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'contracts/**'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, security.configs.recommended, prettier],
    languageOptions: {
      parserOptions: { experimentalDecorators: true, project: './tsconfig.json' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      // Every SET LOCAL interpolation point is already guarded by an
      // explicit UUID-format check right before it (see enable-rls.ts'
      // own doc comments and tenant-context.interceptor.ts /
      // tenant-sweep.service.ts / tenant-context.service.ts) — the one
      // place raw SQL template strings are legitimate in this codebase.
      // Flagged file-by-file below instead of disabled globally, so a
      // *new* raw-query call anywhere else still gets caught.
      'security/detect-object-injection': 'off',
    },
  },
  {
    // Walks this project's own fixed `src/` tree to enforce the
    // thin-controllers rule — never attacker-influenced input, so the
    // non-literal-fs-filename warning here is a false positive.
    files: ['tests/architecture/thin-controllers.spec.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
);
