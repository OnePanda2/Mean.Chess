import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const DETERMINISM =
  'The rules engine and the computer opponent must be deterministic: pass a clock or seed in (docs/ENGINE.md, docs/AI.md).'
const FRAMEWORK_FREE = 'The rules engine and the computer opponent must stay framework-free (docs/ENGINE.md, docs/AI.md).'

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
      // React handlers like onClick={() => setOpen(false)} are clearer as arrow shorthands.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  // The engine and computer-opponent boundary: no UI, no DOM, no randomness, no clock. The AI may
  // use the engine (through src/engine/index.ts); the engine never uses the AI.
  {
    files: ['src/engine/**/*.ts', 'src/ai/**/*.ts'],
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
        ...['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'fetch', 'self', 'postMessage'].map(
          (name) => ({ name, message: FRAMEWORK_FREE }),
        ),
        { name: 'performance', message: DETERMINISM },
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

  // The rules engine stands alone: it never depends on the computer opponent.
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react/*', 'react-dom', 'react-dom/*'], message: FRAMEWORK_FREE },
            { group: ['**/app/**', '**/components/**', '**/styles/**', '**/ai/**'], message: FRAMEWORK_FREE },
          ],
        },
      ],
    },
  },

  {
    files: ['tests/**/*.{ts,tsx}', 'tools/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
])
