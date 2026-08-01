import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for slim end-to-end / visual-regression tests.
 *
 * These tests drive the real app in a real browser (WebGL required for the
 * deck.gl bulk-annotation overlay) and compare screenshots against committed
 * baselines to catch rendering regressions.
 *
 * Data source: by default the app is configured (public/config/e2e.js) to talk
 * to the public NCI Imaging Data Commons proxy, so no local DICOM server is
 * needed. Override the target study/series with E2E_* env vars (see the spec).
 *
 * WebGL determinism: Chromium is launched with ANGLE + SwiftShader (software
 * rendering) so the exact same pixels are produced on any machine. Because
 * SwiftShader output still differs between operating systems, screenshot
 * baselines are stored per-platform and MUST be generated on the same OS as CI
 * (Linux). Use `pnpm test:e2e:update:docker` to (re)generate Linux baselines
 * locally via the pinned Playwright container. See e2e/README.md.
 */

const isCI = Boolean(process.env.CI)

/**
 * When E2E_BASE_URL is set we assume the caller manages the server (e.g. a
 * Linux container pointed at the host, or CI serving a prebuilt bundle), so
 * Playwright should not spawn its own web server.
 */
/**
 * A dedicated port avoids clashes with other dev servers commonly bound to
 * :3000 (note: another IPv6 listener on the same port can shadow slim when
 * "localhost" resolves to ::1).
 */
const externalBaseUrl = process.env.E2E_BASE_URL
const baseURL = externalBaseUrl ?? 'http://127.0.0.1:3977'

export default defineConfig({
  testDir: './e2e',
  /**
   * deck.gl rendering plus cold WSI + bulk-annotation loading over the public
   * proxy is slow, especially under SwiftShader in CI; be generous.
   */
  timeout: 300_000,
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      /**
       * Tolerate minor antialiasing / tile-decode differences in the WSI
       * background while still catching annotation rendering regressions.
       */
      maxDiffPixelRatio: 0.02,
      /** Per-pixel threshold (0-1); higher = more permissive on color. */
      threshold: 0.2,
    },
  },
  /** One heavy WebGL app instance at a time keeps runs deterministic. */
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  /** Keep baselines organized and per-OS so macOS/Linux never clash. */
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{arg}-{platform}{ext}',
  use: {
    baseURL,
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
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
        launchOptions: {
          args: [
            // Force deterministic software WebGL2 (ANGLE + SwiftShader) so the
            // deck.gl overlay renders identically across machines.
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        /**
         * Serve a production build baked with the e2e config. Reuses an
         * already-running dev server locally (e.g. `REACT_APP_CONFIG=e2e pnpm
         * start`) so iterating on specs is fast.
         */
        command: 'pnpm run serve:e2e',
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 180_000,
      },
})
