import { defineConfig, devices } from '@playwright/test'

/**
 * D9 against the docker-compose stack (Slim + writable dcm4chee on :8008).
 * Seed first: `pnpm seed:local-archive`. Run: `pnpm test:e2e:local-archive`.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'save-local.spec.ts',
  outputDir: 'test-results-local-archive',
  timeout: 180_000,
  expect: { timeout: 60_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_LOCAL_ARCHIVE_URL ?? 'http://localhost:8008',
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-local-archive',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
        launchOptions: {
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
})
