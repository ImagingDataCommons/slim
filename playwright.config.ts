import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3100)

/**
 * End-to-end suite for the manual test plan in e2e/TEST-PLAN.md. Runs the dev
 * server with public/config/e2e.js, which reads real slides from the public
 * IDC DICOMweb proxy, so tests need network access but no credentials.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  /** IDC is a shared production proxy; keep the load modest */
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
    command: `./scripts/set-git-env.sh vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/config/e2e.js`,
    env: { REACT_APP_CONFIG: 'e2e', BROWSER: 'none' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
