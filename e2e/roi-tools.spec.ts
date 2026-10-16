import { expect, type Page } from '@playwright/test'

import { newSharedPage, test } from './fixtures'
import {
  captureSettledViewport,
  chooseOption,
  configureDraw,
  drawGeometry,
  drawPolygon,
  expectViewportToDiffer,
  GEOMETRY_LABELS,
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

  test('D7 each geometry type draws an ROI', async ({ page }) => {
    test.setTimeout(240_000)
    await openViewer(page, slideUrl)
    const rois = await section(slidePanel(page), 'Annotations')
    for (const [index, geometry] of GEOMETRY_LABELS.entries()) {
      const before = await rois
        .getByRole('button', { name: /^ROI \d+ / })
        .count()
      await pressViewerShortcut(page, 'KeyD')
      await configureDraw(page, 'Tumor', geometry)
      await drawGeometry(page, geometry, (index - 3) * 35)
      await expect
        .poll(() => rois.getByRole('button', { name: /^ROI \d+ / }).count(), {
          message: `${geometry} should add an ROI`,
          timeout: 20_000,
        })
        .toBe(before + 1)
      await page.keyboard.press('Escape')
      await expect(
        page.getByRole('button', { name: 'Draw', exact: true }),
      ).toHaveAttribute('aria-pressed', 'false')
    }
  })

  test('D8 modify, translate, measure and Esc cancel drawing', async ({
    page,
  }) => {
    await openViewer(page, slideUrl)
    await pressViewerShortcut(page, 'KeyD')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Configure annotation')).toBeVisible()
    const selects = dialog.getByRole('combobox')
    await chooseOption(page, selects.first(), 'Tumor')
    await chooseOption(page, selects.last(), 'Polygon')
    await dialog.locator('#measure-checkbox').click()
    await dialog.getByRole('button', { name: 'Start drawing' }).click()
    await expect(dialog).toBeHidden()
    await drawPolygon(page, -80)
    await page.keyboard.press('Escape')
    const rois = await section(slidePanel(page), 'Annotations')
    const roi1 = rois.getByRole('button', { name: /^ROI 1 / })
    await expect(roi1).toBeVisible()
    await expect(rois.getByText(/µm|mm/)).toBeVisible()

    await roi1.click()
    await pressViewerShortcut(page, 'KeyM')
    await expect(
      page.getByRole('button', { name: 'Modify', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await pressViewerShortcut(page, 'KeyT')
    await expect(
      page.getByRole('button', { name: 'Translate', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')

    await pressViewerShortcut(page, 'KeyD')
    await configureDraw(page, 'Tumor', 'Point')
    await expect(
      page.getByRole('button', { name: 'Draw', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'Draw', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(rois.getByRole('button', { name: /^ROI 2 / })).toHaveCount(0)
  })
})

type Rectangle = Awaited<ReturnType<typeof drawPolygon>>

/** A point on the outline; OpenLayers hit-tests the stroke, not the fill */
function leftEdge(rectangle: Rectangle): { x: number; y: number } {
  return { x: rectangle.left, y: (rectangle.top + rectangle.bottom) / 2 }
}

/** Two drawn polygons side by side: ROI 1 is Tumor (left), ROI 2 is Tissue (right) */
test.describe('ROI selection on one H&E slide', () => {
  test.describe.configure({ mode: 'serial' })
  let page: Page
  let tumor: Rectangle
  let tissue: Rectangle

  const roiButton = (roi: number) =>
    slidePanel(page).getByRole('button', { name: new RegExp(`^ROI ${roi} `) })

  test.beforeAll(async ({ browser }) => {
    page = await newSharedPage(browser)
    await openViewer(page, slideUrl)
    await pressViewerShortcut(page, 'KeyD')
    await configureDraw(page, 'Tumor', 'Polygon', 'G1')
    tumor = await drawPolygon(page, -150)
    await page.keyboard.press('Escape')
    await pressViewerShortcut(page, 'KeyD')
    await configureDraw(page, 'Tissue', 'Polygon')
    tissue = await drawPolygon(page, 150)
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'Draw', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
    await section(slidePanel(page), 'Annotations')
    await expect(roiButton(1)).toBeVisible()
    await expect(roiButton(2)).toBeVisible()
  })

  /**
   * OpenLayers reads two clicks within 250 ms as a double-click, wherever they
   * land, and a double-click opens the modal ROI details
   */
  test.beforeEach(async () => {
    await page.waitForTimeout(300)
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('D10 clicking ROIs in the viewport selects them, Shift adds to the selection', async () => {
    const tumorEdge = leftEdge(tumor)
    await page.mouse.click(tumorEdge.x, tumorEdge.y)
    await expect(roiButton(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(roiButton(2)).toHaveAttribute('aria-pressed', 'false')

    await page.waitForTimeout(300)
    const tissueEdge = leftEdge(tissue)
    await page.keyboard.down('Shift')
    await page.mouse.click(tissueEdge.x, tissueEdge.y)
    await page.keyboard.up('Shift')
    await expect(roiButton(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(roiButton(2)).toHaveAttribute('aria-pressed', 'true')

    await page.waitForTimeout(300)
    await page.mouse.click(tumorEdge.x, tumor.top - 60)
    await expect(roiButton(1)).toHaveAttribute('aria-pressed', 'false')
    await expect(roiButton(2)).toHaveAttribute('aria-pressed', 'false')
  })

  test('D11 double-clicking an ROI opens its details', async () => {
    const edge = leftEdge(tumor)
    await page.mouse.dblclick(edge.x, edge.y)
    const dialog = page.getByRole('dialog', { name: 'Selected ROI' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Tumor')
    await expect(dialog).toContainText('G1')
    await dialog.getByRole('button', { name: 'Done' }).click()
    await expect(dialog).toBeHidden()
  })

  test('D12 hovering an ROI shows a tooltip with its finding', async () => {
    const edge = leftEdge(tissue)
    await page.mouse.move(edge.x, edge.y)
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toContainText('ROI 2')
    await expect(tooltip).toContainText('Tissue')
    await page.mouse.move(edge.x, tissue.top - 60)
    await expect(tooltip).toBeHidden()
  })

  test('D13 selecting an ROI in the Annotations list highlights it on the slide', async () => {
    const center = await mainViewportCenter(page)
    await page.mouse.move(center.x, tissue.top - 60)
    const unselected = await captureSettledViewport(page)
    await roiButton(2).click()
    await expect(roiButton(2)).toHaveAttribute('aria-pressed', 'true')
    await expectViewportToDiffer(page, unselected, 0.05)

    await roiButton(1).click()
    await expect(roiButton(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(roiButton(2)).toHaveAttribute('aria-pressed', 'false')
  })
})
