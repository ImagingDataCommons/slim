import { expect, type Locator, type Page, test } from '@playwright/test'

import {
  captureSettledViewport,
  expectViewportToDiffer,
  mainViewportCenter,
  openViewer,
  pressViewerShortcut,
  section,
  slidePanel,
} from './helpers'
import { seriesUrl, studies } from './studies'

const slideUrl = seriesUrl({
  study: studies.he.study,
  series: studies.he.firstSlide,
})

async function chooseOption(
  page: Page,
  trigger: Locator,
  option: string,
): Promise<void> {
  await trigger.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** Configures the Draw dialog: finding, optional grade, then geometry */
async function configureDraw(
  page: Page,
  finding: string,
  geometry: string,
  grade?: string,
): Promise<void> {
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Configure annotation')).toBeVisible()
  const selects = dialog.getByRole('combobox')
  await chooseOption(page, selects.first(), finding)
  if (grade !== undefined) await chooseOption(page, selects.nth(1), grade)
  await chooseOption(page, selects.last(), geometry)
  await dialog.getByRole('button', { name: 'Start drawing' }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Draw', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
}

/** Clicks the corners of a rectangle and closes it on the first point */
async function drawPolygon(page: Page): Promise<void> {
  const { x, y } = await mainViewportCenter(page)
  const corners = [
    [x - 120, y - 80],
    [x + 120, y - 80],
    [x + 120, y + 80],
    [x - 120, y + 80],
    [x - 120, y - 80],
  ]
  for (const [cornerX, cornerY] of corners) {
    await page.mouse.click(cornerX, cornerY)
  }
}

test.describe('ROI tools', () => {
  test('D1 draw a polygon ROI with a finding and an evaluation', async ({
    page,
  }) => {
    await openViewer(page, slideUrl)
    await page.getByRole('button', { name: 'Draw', exact: true }).click()
    await configureDraw(page, 'Tumor', 'Polygon', 'G2')
    await drawPolygon(page)
    const rois = await section(slidePanel(page), 'Annotations')
    await expect(
      rois.getByRole('button', { name: /^ROI 1 .*Tumor/ }),
    ).toBeVisible()
  })

  test('D2 the Draw dialog keeps its choices when reopened', async ({
    page,
  }) => {
    await openViewer(page, slideUrl)
    await pressViewerShortcut(page, 'KeyD')
    const dialog = page.getByRole('dialog')
    const selects = dialog.getByRole('combobox')
    await chooseOption(page, selects.first(), 'Tumor')
    await chooseOption(page, selects.nth(1), 'G3')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()

    await pressViewerShortcut(page, 'KeyD')
    await expect(selects.first()).toHaveText('Tumor')
    await expect(selects.nth(1)).toHaveText('G3')
  })

  test('D3 findings restrict geometry types and all types are offered otherwise', async ({
    page,
  }) => {
    await openViewer(page, slideUrl)
    await pressViewerShortcut(page, 'KeyD')
    const selects = page.getByRole('dialog').getByRole('combobox')
    await chooseOption(page, selects.first(), 'Invasive tumor border')
    await selects.last().click()
    await expect(page.getByRole('option')).toHaveText([
      'Line',
      'Line (freehand)',
    ])
    await page.getByRole('option', { name: 'Line', exact: true }).click()
    await chooseOption(page, selects.first(), 'Tumor')
    await selects.last().click()
    await expect(page.getByRole('option')).toHaveCount(7)
  })

  test('D4 point ROI, hide with Alt+V and remove with confirmation', async ({
    page,
  }) => {
    await openViewer(page, slideUrl)
    await pressViewerShortcut(page, 'KeyD')
    await configureDraw(page, 'Tumor', 'Point')
    const center = await mainViewportCenter(page)
    await page.mouse.click(center.x, center.y)
    const rois = await section(slidePanel(page), 'Annotations')
    await expect(rois.getByRole('button', { name: /^ROI 1 / })).toBeVisible()
    await page.keyboard.press('Escape')

    const shown = await captureSettledViewport(page)
    await pressViewerShortcut(page, 'KeyV')
    await expectViewportToDiffer(page, shown, 0)
    await pressViewerShortcut(page, 'KeyV')

    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog'))
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: /Remove|Delete/ }).click()
    await expect(rois.getByRole('button', { name: /^ROI 1 / })).toHaveCount(0)
  })

  test('D5 Go to validates input and centers on slide coordinates', async ({
    page,
  }) => {
    await openViewer(page, slideUrl)
    const before = await captureSettledViewport(page)
    await pressViewerShortcut(page, 'KeyG')
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByRole('heading', { name: 'Go to position' }),
    ).toBeVisible()
    const x = dialog.getByLabel('X coordinate (mm)')
    const y = dialog.getByLabel('Y coordinate (mm)')
    const [xMin, xMax] = (await x.getAttribute('placeholder'))
      ?.split(' – ')
      .map(Number) ?? [0, 0]
    const [yMin, yMax] = (await y.getAttribute('placeholder'))
      ?.split(' – ')
      .map(Number) ?? [0, 0]

    await x.fill(String(xMax + 1000))
    await expect(x).toHaveAttribute('aria-invalid', 'true')

    await x.fill(((xMin + xMax) / 2 + (xMax - xMin) / 4).toFixed(2))
    await y.fill(((yMin + yMax) / 2).toFixed(2))
    await dialog.getByLabel('Magnification').fill('10')
    await dialog.getByRole('button', { name: 'Go to position' }).click()
    await expect(dialog).toBeHidden()
    await expectViewportToDiffer(page, before, 5)
  })

  /**
   * Building the SR needs the dcmjs patch in patches/. The e2e server is
   * read-only, so the store is expected to fail with a visible error.
   */
  test('D6 Save shows the report and a read-only server rejects it', async ({
    page,
  }) => {
    await openViewer(page, slideUrl)
    await pressViewerShortcut(page, 'KeyD')
    await configureDraw(page, 'Tissue', 'Polygon')
    await drawPolygon(page)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Save annotations')).toBeVisible()
    await expect(dialog).toContainText('Tissue')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Annotations could not be saved')).toBeVisible()
  })
})
