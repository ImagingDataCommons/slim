import { expect, type Page } from '@playwright/test'

import { test } from './fixtures'
import {
  configureDraw,
  expectTissueRendered,
  mainViewportCenter,
  openViewer,
  overrideConfig,
  pressViewerShortcut,
  section,
  serveFromIdc,
  slidePanel,
} from './helpers'
import { seriesUrl, studies } from './studies'

const { he } = studies
const heUrl = seriesUrl({ study: he.study, series: he.firstSlide })

async function openUserMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Guest/ }).click()
}

test.describe('Configuration', () => {
  test('C1 disableWorklist hides the worklist and the Worklist link', async ({
    page,
  }) => {
    await overrideConfig(page, { disableWorklist: true })
    await page.goto('/')
    await expect(page.getByText('Worklist has been disabled.')).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)

    await openViewer(page, heUrl)
    await expect(page.getByRole('link', { name: 'Worklist' })).toHaveCount(0)
  })

  test('C2 disableAnnotationTools removes the ROI tools and their shortcuts', async ({
    page,
  }) => {
    await overrideConfig(page, { disableAnnotationTools: true })
    await openViewer(page, heUrl)
    for (const tool of ['Draw', 'Modify', 'Translate', 'Remove', 'Save']) {
      await expect(
        page.getByRole('button', { name: tool, exact: true }),
      ).toHaveCount(0)
    }
    await pressViewerShortcut(page, 'KeyD')
    await pressViewerShortcut(page, 'KeyG')
    await expect(
      page.getByRole('heading', { name: 'Go to position' }),
    ).toBeVisible()
    await expect(page.getByText('Configure annotation')).toHaveCount(0)
  })

  test('C4 a Google Cloud route reads from that DICOM store', async ({
    page,
  }) => {
    const gcpBaseUrl = 'https://healthcare.e2e.test/v1'
    const store = '/projects/demo/locations/us/datasets/slides/dicomStores/he'
    await overrideConfig(page, { gcpBaseUrl })
    await serveFromIdc(page, `${gcpBaseUrl}${store}/dicomWeb`)
    await openViewer(page, `${store}/study/${he.study}`)
    await expect(
      page.getByRole('button', {
        name: `Server ${gcpBaseUrl}${store}/dicomWeb. Change server`,
      }),
    ).toBeVisible()
    await expectTissueRendered(page)
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  })

  test('C5 mode light starts in the light theme', async ({ page }) => {
    await overrideConfig(page, { mode: 'light' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/light/)
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('C6 messages.disabled silences those toast tones only', async ({
    page,
  }) => {
    /**
     * Toasts stay open (duration 0), so the final absence check would see a
     * success toast that slipped through instead of one that already closed
     */
    await overrideConfig(page, {
      messages: { disabled: ['success'], duration: 0 },
    })
    await openViewer(page, heUrl)
    await pressViewerShortcut(page, 'KeyD')
    await configureDraw(page, 'Tumor', 'Point')
    const center = await mainViewportCenter(page)
    await page.mouse.click(center.x, center.y)
    const rois = await section(slidePanel(page), 'Annotations')
    await expect(rois.getByRole('button', { name: /^ROI 1 / })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog'))
    await confirm.getByRole('button', { name: /Remove|Delete/ }).click()
    await expect(confirm).toBeHidden()
    await expect(rois.getByRole('button', { name: /^ROI 1 / })).toHaveCount(0)

    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(
      page.getByText('No annotation was selected for removal'),
    ).toBeVisible()
    await expect(page.getByText('Annotation was removed')).toHaveCount(0)
  })

  test('C7 a custom logo and organization replace the defaults', async ({
    page,
  }) => {
    await overrideConfig(page, { organization: 'Pathology Lab' })
    await page.route('**/logo.svg', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 10"><rect width="40" height="10" fill="#1f5ad1"/></svg>',
      }),
    )
    await page.goto('/')
    await expect(page.locator('header img[alt="Slim"]')).toBeVisible()

    await openUserMenu(page)
    await expect(page.getByRole('menu')).toContainText('Pathology Lab')
    await page.getByRole('menuitem', { name: 'About Slim' }).click()
    await expect(page.getByRole('dialog')).toContainText('Pathology Lab')
  })
})
