/**
 * Browser end-to-end tests for online play (docs/ONLINE-TEST-PLAN.md §6): two real browser contexts
 * against the real game server (`wrangler dev`) and the site (`vite`). Run with `npm run test:e2e`.
 *
 * Own ports (8788, 4174) so a dev server already running on 8787/5173 is never reused by mistake; the
 * run refuses to start if either port is busy. The game server gets fresh storage every run.
 */
import { defineConfig, devices } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SERVER_PORT = 8788
const SITE_PORT = 4174
const SITE = `http://localhost:${SITE_PORT}`
const state = mkdtempSync(join(tmpdir(), 'meanchess-e2e-'))
const ci = process.env.CI !== undefined

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: ci ? [['list'], ['github']] : 'list',
  use: {
    baseURL: SITE,
    // Locally the installed Chrome is enough; CI installs Playwright's Chromium.
    ...(ci ? {} : { channel: 'chrome' }),
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node node_modules/wrangler/bin/wrangler.js dev -c server/wrangler.jsonc --port ${SERVER_PORT} --persist-to "${state}" --var ALLOWED_ORIGINS:${SITE}`,
      url: `http://localhost:${SERVER_PORT}/v1/health`,
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      command: `node node_modules/vite/bin/vite.js --port ${SITE_PORT} --strictPort`,
      url: `${SITE}/online/`,
      env: { VITE_ONLINE_URL: `http://localhost:${SERVER_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
