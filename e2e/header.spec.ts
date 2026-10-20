import { expect, type Page } from '@playwright/test'

import { newSharedPage, test } from './fixtures'
import {
  goToSlideCenter,
  openViewer,
  section,
  serveFromIdc,
  slidePanel,
} from './helpers'
import { seriesUrl, studies } from './studies'

const { he } = studies

function worklistRows(page: Page) {
  return page.getByRole('table').getByRole('rowgroup').nth(1).getByRole('row')
}

async function openUserMenuItem(page: Page, item: string): Promise<void> {
  await page.getByRole('button', { name: /Guest|Not signed in/ }).click()
  await page.getByRole('menuitem', { name: item }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.describe('Header dialogs on one H&E slide', () => {
  test.describe.configure({ mode: 'serial' })
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await newSharedPage(browser)
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('H1 tag browser filters attributes of the open slide', async () => {
    await page.getByRole('button', { name: 'DICOM tag browser' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/\d+ attributes/)).toBeVisible()
    await dialog
      .getByRole('searchbox', { name: 'Filter tags' })
      .fill('PatientID')
    await expect(dialog.getByText('PatientID', { exact: true })).toBeVisible()
    await expect(dialog.getByText(he.patientId).first()).toBeVisible()
    await dialog.getByRole('button', { name: 'Done' }).click()
    await expect(dialog).toBeHidden()
  })

  test('H4 debug dialog lists session messages', async () => {
    await page.getByRole('button', { name: /^Debug info/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByText('Errors and warnings from this session'),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('H15 tag browser expands sequences and switches instance and series', async () => {
    await page.getByRole('button', { name: 'DICOM tag browser' }).click()
    const dialog = page.getByRole('dialog', { name: 'DICOM tag browser' })
    const sequence = dialog.getByRole('button', {
      name: /CodingSchemeIdentificationSequence/,
    })
    const firstItem = dialog.getByRole('button', { name: /^\(0008,0110\)\.1 / })
    await sequence.click()
    await expect(sequence).toHaveAttribute('aria-expanded', 'true')
    await expect(firstItem).toBeVisible()

    await dialog.getByRole('button', { name: 'Collapse all' }).click()
    await expect(firstItem).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Expand all' }).click()
    await expect(
      dialog.getByText('CodingSchemeDesignator').first(),
    ).toBeVisible()

    const instance = dialog.getByRole('slider', { name: 'Instance' })
    const position = dialog.getByText(/^\d+\s\/\s\d+$/)
    const size = dialog.getByText(/^[\d\s]+×[\d\s]+px$/)
    const firstSize = await size.innerText()
    await instance.press('End')
    await expect(position).toHaveText(/^(\d+)\s\/\s\1$/)
    await expect(size).not.toHaveText(firstSize)

    const series = dialog.getByRole('combobox', { name: 'Series' })
    await series.click()
    const other = page.getByRole('option', { selected: false }).first()
    const otherLabel = (await other.innerText()).trim()
    await other.click()
    await expect(series).toContainText(otherLabel)
    await expect(dialog.getByText(/\d+ attributes/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Done' }).click()
    await expect(dialog).toBeHidden()
  })
})

test.describe('Header and dialogs', () => {
  test('H2 tag browser is not offered on the worklist', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Studies' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'DICOM tag browser' }),
    ).toHaveCount(0)
  })

  test('H3 server dialog validates a custom URL and keeps the default', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Select server' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Select DICOMweb server')).toBeVisible()
    await dialog.getByText('Use custom server').click()
    const url = dialog.getByLabel('Server URL')
    await url.fill('not a url')
    await url.blur()
    await expect(
      dialog.getByText(/Enter a URL starting with http/),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(
      page.getByRole('button', { name: /^Server https:\/\/proxy\.imaging/ }),
    ).toBeVisible()
  })

  test('H5 theme switches between light and dark and persists', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await openUserMenuItem(page, 'Preferences')
    await page
      .getByRole('dialog')
      .locator('label')
      .filter({ hasText: /^Light$/ })
      .click()
    await page.getByRole('button', { name: 'Save preferences' }).click()
    await expect(page.locator('html')).toHaveClass(/light/)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/light/)
  })

  test('H6 hiding the overview map in preferences removes it from the viewer', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
    await openUserMenuItem(page, 'Preferences')
    await page.getByRole('switch', { name: /Overview map/ }).click()
    await page.getByRole('button', { name: 'Save preferences' }).click()
    await expect(page.locator('[data-overview-map="hidden"]')).toBeVisible()
  })

  test('H7 keyboard shortcuts, configuration and about tabs open', async ({
    page,
  }) => {
    await page.goto('/')
    await openUserMenuItem(page, 'Keyboard shortcuts')
    await expect(page.getByRole('dialog')).toContainText(/Alt/)
    await page.keyboard.press('Escape')

    await openUserMenuItem(page, 'Configuration')
    await expect(page.getByRole('dialog')).toContainText('proxy.imaging')
    await page.keyboard.press('Escape')

    await openUserMenuItem(page, 'About Slim')
    await expect(page.getByRole('dialog')).toContainText(/0\.\d+\.\d+/)
  })

  test('H8 a custom server lists its studies and survives a reload', async ({
    page,
  }) => {
    const customUrl = 'https://dicom.e2e.test/dicomWeb'
    await serveFromIdc(page, customUrl)
    await page.goto('/')
    await page.getByRole('button', { name: 'Select server' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByText('Use custom server').click()
    await dialog.getByLabel('Server URL').fill(customUrl)
    await dialog.getByRole('button', { name: 'OK' }).click()
    await expect(dialog).toBeHidden()

    const serverPill = page.getByRole('button', {
      name: `Server ${customUrl}. Change server`,
    })
    await expect(serverPill).toBeVisible()
    await expect(worklistRows(page).first()).toBeVisible({ timeout: 60_000 })
    await page.reload()
    await expect(serverPill).toBeVisible()
    await expect(worklistRows(page).first()).toBeVisible({ timeout: 60_000 })
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  })

  test('H9 viewer overlays hide with their preference switches', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
    const zoomIn = page.getByRole('button', { name: 'Zoom in' })
    const scale = page.getByText(/× · [\d.]+ µm\/px/)
    await expect(zoomIn).toBeVisible()
    await expect(scale).toBeVisible()

    await openUserMenuItem(page, 'Preferences')
    for (const name of ['Scale and position', 'Slide name', 'Zoom controls']) {
      const toggle = page.getByRole('switch', { name })
      await expect(toggle).toBeChecked()
      await toggle.click()
    }
    await page.getByRole('button', { name: 'Save preferences' }).click()
    await expect(zoomIn).toHaveCount(0)
    await expect(scale).toHaveCount(0)
  })

  test('H10 stroke color and width apply to new ROIs in the default style', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
    await openUserMenuItem(page, 'Preferences')
    const prefs = page.getByRole('dialog')
    await prefs.getByRole('tab', { name: 'Annotations' }).click()
    await prefs.getByRole('button', { name: 'Stroke color #d9453b' }).click()
    const width = prefs.getByRole('slider', { name: 'Stroke width' })
    await width.press('ArrowRight')
    /** First "N px" label is stroke width; label font size comes later */
    const strokeWidthValue = prefs.getByText(/^\d+ px$/).first()
    const widthLabel = await strokeWidthValue.innerText()
    await page.getByRole('button', { name: 'Save preferences' }).click()
    await expect(prefs).toBeHidden()

    await goToSlideCenter(page)
    const rois = await section(slidePanel(page), 'Annotations')
    await expect(
      rois
        .getByRole('button', { name: /^ROI 1 / })
        .locator('[style*="background"]'),
    ).toHaveCSS('background-color', 'rgb(217, 69, 59)')

    await openUserMenuItem(page, 'Preferences')
    await prefs.getByRole('tab', { name: 'Annotations' }).click()
    await expect(
      prefs.getByRole('button', { name: 'Stroke color #d9453b' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(strokeWidthValue).toHaveText(widthLabel)
  })

  test('H11 turning off Confirm before removing removes ROIs at once', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
    await openUserMenuItem(page, 'Preferences')
    const prefs = page.getByRole('dialog')
    await prefs.getByRole('tab', { name: 'Annotations' }).click()
    const confirm = prefs.getByRole('switch', {
      name: 'Confirm before removing',
    })
    await expect(confirm).toBeChecked()
    await confirm.click()
    await page.getByRole('button', { name: 'Save preferences' }).click()
    await expect(prefs).toBeHidden()

    await goToSlideCenter(page)
    const rois = await section(slidePanel(page), 'Annotations')
    await expect(rois.getByRole('button', { name: /^ROI 1 / })).toBeVisible()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(rois.getByRole('button', { name: /^ROI 1 / })).toHaveCount(0)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('H12 System theme follows the operating system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await openUserMenuItem(page, 'Preferences')
    await page
      .getByRole('dialog')
      .locator('label')
      .filter({ hasText: /^System$/ })
      .click()
    await page.getByRole('button', { name: 'Save preferences' }).click()
    await expect(page.locator('html')).toHaveClass(/light/)
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('H13 configuration search filters the settings', async ({ page }) => {
    await page.goto('/')
    await openUserMenuItem(page, 'Configuration')
    const dialog = page.getByRole('dialog')
    await dialog
      .getByRole('searchbox', { name: 'Search configuration' })
      .fill('disableWorklist')
    await expect(dialog.getByText('disableWorklist').first()).toBeVisible()
    await expect(dialog.getByText('enableServerSelection')).toHaveCount(0)
  })

  test('H14 Copy for support ticket copies the versions and browser', async ({
    page,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    await openUserMenuItem(page, 'About Slim')
    await page.getByRole('button', { name: 'Copy for support ticket' }).click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/^slim 0\.\d+\.\d+/i)
    expect(copied).toContain('Slim commit:')
    expect(copied).toContain('User agent:')
  })
})
