import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        // The rules engine is framework-free, so its tests run in plain Node.
        extends: true,
        test: {
          name: 'engine',
          include: ['tests/engine/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // The computer opponent's search is framework-free too.
        extends: true,
        test: {
          name: 'ai',
          include: ['tests/ai/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          include: ['tests/ui/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/ui/setup.ts'],
          // Rendering slows down while the engine and AI suites run in parallel (CI has few cores).
          testTimeout: 20_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/ai/**/*.ts'],
      thresholds: {
        // docs/BLUEPRINT.md §6.1: the rules engine is the highest-risk code.
        'src/engine/**/*.ts': { lines: 95, functions: 95, statements: 95, branches: 90 },
        // The computer opponent (docs/AI.md). Its typed-array reads carry `?? 0` guards that strict
        // index checking requires but that can never fire, so branch coverage reads lower than it is.
        'src/ai/**/*.ts': { lines: 95, functions: 95, statements: 95, branches: 75 },
      },
    },
  },
})
