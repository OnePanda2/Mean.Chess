import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const DETERMINISM = 'The rules engine must be deterministic (see docs/BLUEPRINT.md §4.8).'
const FRAMEWORK_FREE = 'The rules engine must stay framework-free (see docs/BLUEPRINT.md §4.8).'

export default defineConfig([
  // Research scripts are throwaway evidence, not product code.
  globalIgnores(['dist', 'coverage', 'tools/research']),

  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  // The engine boundary: no UI, no DOM, no randomness, no clock.
  {
    files: ['src/engine/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react/*', 'react-dom', 'react-dom/*'], message: FRAMEWORK_FREE },
            { group: ['**/app/**', '**/components/**', '**/styles/**'], message: FRAMEWORK_FREE },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'fetch'].map((name) => ({
          name,
          message: FRAMEWORK_FREE,
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: DETERMINISM },
        { object: 'Date', property: 'now', message: DETERMINISM },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: DETERMINISM },
      ],
    },
  },

  {
    files: ['tests/**/*.{ts,tsx}', 'tools/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
])
