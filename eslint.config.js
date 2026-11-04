import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const ban = (names, message) => ({
  patterns: [{ group: names, message }],
});

const noThrowError = {
  selector: "ThrowStatement > NewExpression[callee.name='Error']",
  message: 'Use fail(code, ...) from @youwho/errors instead of throw new Error.',
};

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'docs/**', '**/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Plain Node scripts (development aids)
  { files: ['**/*.mjs'], languageOptions: { globals: { URL: 'readonly', console: 'readonly' } } },
  // The web app's service worker: plain JavaScript in the worker scope
  {
    files: ['apps/web/public/sw.js'],
    languageOptions: { sourceType: 'script', globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly', Response: 'readonly', setTimeout: 'readonly' } },
  },
  {
    rules: {
      'no-restricted-syntax': ['error', noThrowError],
    },
  },
  // packages/errors depends on nothing
  {
    files: ['packages/errors/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', ban(['@youwho/*', 'zod', 'pino'], 'errors depends on nothing.')],
    },
  },
  // packages/core depends only on errors and zod
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        ban(
          ['@youwho/db', '@youwho/notify', '@youwho/config', 'pino', 'postgres', 'drizzle-orm*', 'node:*'],
          'core stays pure: only errors and zod, no I/O.',
        ),
      ],
    },
  },
  // db and notify may use core and errors
  {
    files: ['packages/db/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', ban(['@youwho/notify', '@youwho/config', 'apps/*'], 'db may only use core and errors.')],
    },
  },
  {
    files: ['packages/notify/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', ban(['@youwho/db', '@youwho/config', 'apps/*'], 'notify may only use core and errors.')],
    },
  },
  // config depends on zod and pino
  {
    files: ['packages/config/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', ban(['@youwho/db', '@youwho/notify', '@youwho/core', 'apps/*'], 'config depends on zod and pino only.')],
    },
  },
  // client code never imports server-only packages
  {
    files: ['apps/web/src/client/**/*.{ts,tsx}', 'apps/web/src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@youwho/db', '@youwho/notify', '@youwho/config'], message: 'Client code must not import db, notify or config.' },
            { group: ['**/server/**', '@/server/**'], allowTypeImports: true, message: 'Client code may only import types from server code.' },
          ],
        },
      ],
    },
  },
  // packages never import apps
  {
    files: ['packages/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', ban(['**/apps/**'], 'Packages never import apps.')],
    },
  },
);
