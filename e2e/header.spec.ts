import { expect, type Page } from '@playwright/test'

import { newSharedPage, test } from './fixtures'
import { openViewer } from './helpers'
import { seriesUrl, studies } from './studies'

const { he } = studies

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
})
