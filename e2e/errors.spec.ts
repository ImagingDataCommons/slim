import { expect } from '@playwright/test'

import { test } from './fixtures'
import {
  expectTissueRendered,
  openViewer,
  slidePanel,
  waitForTilesSettled,
} from './helpers'
import { seriesUrl, studies } from './studies'

const { he } = studies
const heUrl = seriesUrl({ study: he.study, series: he.firstSlide })

/**
 * Failures use 404, which public/config/e2e.js does not retry, so each test
 * fails fast instead of waiting out the retry backoff.
 */
test.describe('Error handling', () => {
  test('E1 failed tiles are counted in the footer and listed in Debug', async ({
    page,
  }) => {
    await page.route(/\/frames\/\d+/, (route) => route.fulfill({ status: 404 }))
    await page.goto(heUrl)
    await expect(slidePanel(page)).toBeVisible({ timeout: 60_000 })
    const footer = page.locator('footer').filter({ hasText: 'Tiles' })
    await expect(footer).toContainText(/\d+ failed/)

    await page.getByRole('button', { name: /^Debug info/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(/Visualization\s*[1-9]/)
  })

  test('E2 a failed worklist search shows an error', async ({ page }) => {
    await page.route(/\/dicomWeb\/studies\?/, (route) =>
      route.fulfill({ status: 404 }),
    )
    await page.goto('/')
    await expect(
      page.getByText('An error occurred. Search for studies failed.'),
    ).toBeVisible()
  })

  test('E3 a study that fails to load offers Retry, which recovers', async ({
    page,
  }) => {
    let isFailing = true
    await page.route(new RegExp(`/dicomWeb/studies/${he.study}/`), (route) =>
      isFailing ? route.fulfill({ status: 404 }) : route.fallback(),
    )
    await page.goto(heUrl)
    await expect(page.getByText("Couldn't load this study")).toBeVisible({
      timeout: 60_000,
    })

    isFailing = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(slidePanel(page)).toBeVisible({ timeout: 60_000 })
    await waitForTilesSettled(page)
    await expectTissueRendered(page)
  })

  test('E4 a render error shows the error page instead of a blank screen', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window)
      window.matchMedia = (query: string) => {
        if (query.includes('prefers-color-scheme')) {
          throw new Error('e2e: matchMedia is broken')
        }
        return matchMedia(query)
      }
    })
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Reload/ })).toBeVisible()
  })

  test('E6 a viewer bundle that fails to load shows the error page', async ({
    page,
  }) => {
    /** A stale cached page asking for a chunk a redeploy removed */
    await page.route(/\/(src\/App\.tsx|assets\/App-[^/]+\.js)(\?|$)/, (route) =>
      route.fulfill({ status: 404 }),
    )
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Reload/ })).toBeVisible()
  })

  test('E5 high memory use shows in the footer and warns in Debug', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(performance, 'memory', {
        configurable: true,
        get: () => ({
          usedJSHeapSize: 3.8e9,
          totalJSHeapSize: 3.9e9,
          jsHeapSizeLimit: 4e9,
        }),
      })
    })
    await openViewer(page, heUrl)
    await expect(page.locator('footer')).toContainText(
      /Memory\s*3\.5 \/ 3\.7 GB/,
    )

    await page.getByRole('button', { name: /^Debug info/ }).click()
    const dialog = page.getByRole('dialog')
    const warnings = dialog.getByRole('button', { name: /^Warning/ })
    if ((await warnings.getAttribute('aria-expanded')) !== 'true') {
      await warnings.click()
    }
    await expect(dialog).toContainText(/Critical memory usage: 95\.0% used/)
  })
})
