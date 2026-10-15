import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3100)
const isCI = process.env.CI !== undefined

/**
 * CI runners render WebGL in software on a few cores. The dev server (per-module
 * transforms, React dev mode) plus video recording starved them until tests
 * timed out, so CI builds with the e2e config and serves that build, and
 * records a trace only when a test is retried. Building here rather than in a
 * workflow step means a build made with another config is never served.
 */
const serverCommand = isCI
  ? `pnpm run build && vite preview --port ${PORT} --strictPort`
  : `./scripts/set-git-env.sh vite --port ${PORT} --strictPort`

/**
 * End-to-end suite for the manual test plan in e2e/TEST-PLAN.md. Runs Slim
 * with public/config/e2e.js, which reads real slides from the public IDC
 * DICOMweb proxy, so tests need network access but no credentials.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  /** Spreads tests of one file over workers and shards; serial groups stay together */
  fullyParallel: true,
  timeout: 90_000,
  expect: { timeout: 30_000 },
  /** IDC is a shared production proxy; keep the load modest */
  workers: isCI ? 2 : 3,
  retries: isCI ? 1 : 0,
  /** A broken environment fails everything; stop instead of burning the job timeout */
  maxFailures: isCI ? 5 : 0,
  reporter: isCI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1600, height: 900 },
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: isCI ? 'off' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
        /** Headless Chromium renders DMV's WebGL tiles only through SwiftShader */
        launchOptions: {
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: {
    command: serverCommand,
    url: `http://localhost:${PORT}/config/e2e.js`,
    env: { REACT_APP_CONFIG: 'e2e', BROWSER: 'none' },
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
