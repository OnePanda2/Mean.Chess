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
        extends: true,
        test: {
          name: 'ui',
          include: ['tests/ui/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/ui/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      // docs/BLUEPRINT.md §6.1: the rules engine is the highest-risk code.
      thresholds: { lines: 95, functions: 95, statements: 95, branches: 90 },
    },
  },
})
