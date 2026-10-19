import { expect, type Locator, type Page } from '@playwright/test'

import { newSharedPage, test } from './fixtures'
import {
  captureSettledViewport,
  expectTissueRendered,
  expectViewportToDiffer,
  expectViewportToMatch,
  openViewer,
  section,
  slidePanel,
} from './helpers'
import { seriesUrl, studies } from './studies'

const { tcgaRead, tcgaLuad, tcgaGbm, rmsSr, boneMarrow, catchAnn } = studies
const srUrl = seriesUrl({ study: rmsSr.study, series: rmsSr.sr })

/** Name of the first layer shown in a section, read from its "Show …" toggle */
async function visibleLayerName(container: Locator): Promise<string> {
  return (await visibleLayer(container)).name
}

/**
 * The first layer shown in a section, with its position among layers of the
 * same name: one ANN series can repeat a label across categories.
 */
async function visibleLayer(
  container: Locator,
): Promise<{ name: string; index: number }> {
  const toggle = container
    .getByRole('button', { name: /^Show (?!all)/, pressed: true })
    .first()
  const label = await toggle.getAttribute('aria-label')
  expect(label, 'visible layer toggle').not.toBeNull()
  const name = (label ?? '').replace(/^Show /, '')
  const pressed = await container
    .getByRole('button', { name: `Show ${name}`, exact: true })
    .evaluateAll((toggles) =>
      toggles.map((element) => element.getAttribute('aria-pressed')),
    )
  return { name, index: pressed.indexOf('true') }
}

test.describe('Segmentations', () => {
  test('S1 SEG link opens the referenced slide with that segmentation visible', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: tcgaRead.study, series: tcgaRead.fractionalTilSeg }),
    )
    await expectTissueRendered(page)
    const segments = await section(slidePanel(page), 'Segmentations')
    const visibleToggle = page.getByRole('button', {
      name: /^Show (?!all)/,
      pressed: true,
    })
    await expect(segments.locator(visibleToggle)).toHaveCount(1)
    await expect(
      segments
        .locator('div')
        .filter({ has: visibleToggle })
        .filter({ hasText: 'Fractional' })
        .filter({ hasNotText: 'Binary' })
        .first(),
    ).toBeVisible()
  })

  test('S2 hide all and show all segments change the viewport', async ({
    page,
  }) => {
    await openViewer(page, srUrl)
    const segments = await section(slidePanel(page), 'Segmentations')
    const before = await captureSettledViewport(page)
    await segments.getByRole('button', { name: 'Show all segments' }).click()
    await expect(segments.getByText('4 of 4 visible')).toBeVisible()
    await expectViewportToDiffer(page, before, 1)

    await segments.getByRole('button', { name: 'Hide all segments' }).click()
    await expect(segments.getByText('0 of 4 visible')).toBeVisible()
    await expectViewportToMatch(page, before, 1)
  })

  test('S3 a single segment toggles and its opacity changes the overlay', async ({
    page,
  }) => {
    await openViewer(page, srUrl)
    const segments = await section(slidePanel(page), 'Segmentations')
    const toggle = segments.getByRole('button', { name: 'Show STROMA' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const full = await captureSettledViewport(page)

    const opacity = segments.getByRole('slider', { name: 'Opacity of STROMA' })
    await opacity.press('Home')
    await expect(opacity).toHaveAttribute(
      'aria-valuenow',
      (await opacity.getAttribute('aria-valuemin')) ?? '0',
    )
    await expectViewportToDiffer(page, full, 0.5)
  })

  test('S4 series selector switches between segmentation series', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: tcgaRead.study, series: tcgaRead.nucleiSeg }),
    )
    const segments = await section(slidePanel(page), 'Segmentations')
    const series = segments.getByRole('combobox', { name: 'Series' })
    await series.click()
    const options = page.getByRole('option')
    expect(await options.count()).toBeGreaterThan(1)
    await options.last().click()
    await expect(
      segments.getByRole('button', { name: /^Show / }).first(),
    ).toBeVisible()
  })

  test('S5 segment details, color and interpolation', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({ study: tcgaRead.study, series: tcgaRead.nucleiSeg }),
    )
    const segments = await section(slidePanel(page), 'Segmentations')
    const name = await visibleLayerName(segments)

    await segments.getByRole('button', { name: `Details for ${name}` }).click()
    const details = page.getByRole('dialog')
    await expect(details).toContainText('Segmentation type')
    await page.keyboard.press('Escape')
    await expect(details).toBeHidden()

    const before = await captureSettledViewport(page)
    await segments
      .getByRole('button', { name: `Segment color for ${name}` })
      .click()
    const red = page.getByRole('dialog').getByRole('spinbutton', {
      name: 'Red value',
    })
    await red.fill((await red.inputValue()) === '0' ? '255' : '0')
    await red.press('Enter')
    await expectViewportToDiffer(page, before, 0.01)
    await page.keyboard.press('Escape')

    const options = segments.getByRole('button', { name: /^Display options/ })
    await options.click()
    const interpolation = segments.getByRole('switch', {
      name: 'Segment interpolation',
    })
    const wasOn = await interpolation.isChecked()
    await interpolation.click()
    await expect(interpolation).toBeChecked({ checked: !wasOn })
    await expect(options).toContainText(wasOn ? 'Interp. off' : 'Interp. on')
  })

  test('S6 binary TIL SEG link opens the slide with that segmentation visible', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: tcgaLuad.study, series: tcgaLuad.binaryTilSeg }),
    )
    await expectTissueRendered(page)
    const segments = await section(slidePanel(page), 'Segmentations')
    const visibleToggle = page.getByRole('button', {
      name: /^Show (?!all)/,
      pressed: true,
    })
    await expect(segments.locator(visibleToggle)).toHaveCount(1)
    await expect(
      segments
        .locator('div')
        .filter({ has: visibleToggle })
        .filter({ hasText: /Binary/i })
        .filter({ hasNotText: /Fractional/i })
        .first(),
    ).toBeVisible()
  })
})

test.describe('Parametric maps', () => {
  test('P1 parametric map shows and hides on the slide', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({ study: tcgaGbm.study, series: tcgaGbm.parametricMap }),
    )
    const maps = await section(slidePanel(page), 'Parametric maps')
    const toggle = maps.getByRole('button', { name: /^Show / }).last()
    const wasVisible = (await toggle.getAttribute('aria-pressed')) === 'true'
    const before = await captureSettledViewport(page)
    await toggle.click()
    await expect(toggle).toHaveAttribute(
      'aria-pressed',
      wasVisible ? 'false' : 'true',
    )
    await expectViewportToDiffer(page, before, 0.5)
  })

  test('P2 parametric map opacity and interpolation', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({ study: tcgaGbm.study, series: tcgaGbm.parametricMap }),
    )
    const maps = await section(slidePanel(page), 'Parametric maps')
    const name = await visibleLayerName(maps)
    const before = await captureSettledViewport(page)
    const opacity = maps.getByRole('slider', { name: `Opacity of ${name}` })
    await opacity.press('Home')
    await expect(opacity).toHaveAttribute(
      'aria-valuenow',
      (await opacity.getAttribute('aria-valuemin')) ?? '0',
    )
    await expectViewportToDiffer(page, before, 0.5)

    const options = maps.getByRole('button', { name: /^Display options/ })
    await options.click()
    const interpolation = maps.getByRole('switch')
    const wasOn = await interpolation.isChecked()
    await interpolation.click()
    await expect(interpolation).toBeChecked({ checked: !wasOn })
    await expect(options).toContainText(wasOn ? 'Interp. off' : 'Interp. on')
  })
})

test.describe('Annotation groups', () => {
  test('A1 ANN link loads nuclei polygons that hide with their toggle', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    const bulkStatuses: number[] = []
    let pendingBulk = 0
    const isBulk = (url: string): boolean => url.includes('/bulk')
    page.on('request', (request) => {
      if (isBulk(request.url())) pendingBulk++
    })
    page.on('requestfailed', (request) => {
      if (isBulk(request.url())) pendingBulk--
    })
    page.on('response', (response) => {
      if (isBulk(response.url())) bulkStatuses.push(response.status())
    })
    page.on('requestfinished', (request) => {
      if (isBulk(request.url())) pendingBulk--
    })
    await openViewer(
      page,
      seriesUrl({ study: tcgaRead.study, series: tcgaRead.nucleiAnn }),
    )
    const groups = await section(slidePanel(page), 'Annotation groups')
    const toggle = groups.getByRole('button', { name: 'Show Nuclei' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(() => bulkStatuses.includes(200) && pendingBulk === 0, {
        message: 'bulk annotation data downloaded',
        timeout: 90_000,
      })
      .toBe(true)

    const zoomIn = page.getByRole('button', { name: 'Zoom in' })
    for (let step = 0; step < 8; step++) await zoomIn.click()
    /** ~508k polygons draw in bursts; hiding them mid-draw leaves clusters */
    const shown = await captureSettledViewport(page, {
      quietMs: 5_000,
      timeout: 90_000,
    })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expectViewportToDiffer(page, shown, 2)
  })

  test('A2 ANN link turns on its groups; show all and hide all cover every group', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: boneMarrow.study, series: boneMarrow.ann }),
    )
    const groups = await section(slidePanel(page), 'Annotation groups')
    const bulk = groups.getByRole('group', {
      name: 'Visibility of annotation groups',
    })
    /** The linked series holds 5 of the slide's groups */
    await expect(bulk).toContainText(/^5 of \d+ visible/)
    const total = /of (\d+) visible/.exec(await bulk.innerText())?.[1]
    await bulk
      .getByRole('button', { name: 'Show all annotation groups' })
      .click()
    await expect(bulk).toContainText(`${total} of ${total} visible`)
    await bulk
      .getByRole('button', { name: 'Hide all annotation groups' })
      .click()
    await expect(bulk).toContainText(`0 of ${total} visible`)
  })

  test('A3 group color and fill change the drawing', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({ study: boneMarrow.study, series: boneMarrow.ann }),
    )
    const groups = await section(slidePanel(page), 'Annotation groups')
    const { name, index } = await visibleLayer(groups)
    /** The rectangles are a few pixels wide at the overview zoom */
    await groups.getByRole('button', { name, exact: true }).nth(index).click()
    await groups
      .getByRole('button', { name: `Display settings for ${name}` })
      .nth(index)
      .click()
    const settings = page.getByRole('dialog')
    const before = await captureSettledViewport(page)

    const red = settings.getByRole('spinbutton', { name: 'Red value' })
    await red.fill((await red.inputValue()) === '0' ? '255' : '0')
    await red.press('Enter')
    await expectViewportToDiffer(page, before, 0.01)

    const outlined = await captureSettledViewport(page)
    const fillOpacity = settings.getByRole('slider', { name: 'Fill opacity' })
    await expect(fillOpacity).toBeDisabled()
    await settings.getByRole('switch', { name: 'Fill shapes' }).click()
    await expect(fillOpacity).toBeEnabled()
    await expectViewportToDiffer(page, outlined, 0.01)
  })

  test('A5 zoom to group frames that group', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({ study: boneMarrow.study, series: boneMarrow.ann }),
    )
    const groups = await section(slidePanel(page), 'Annotation groups')
    const { name, index } = await visibleLayer(groups)
    const scale = page.getByText(/× · [\d.]+ µm\/px/)
    const overview = await scale.innerText()
    const before = await captureSettledViewport(page)
    await groups.getByRole('button', { name, exact: true }).nth(index).click()
    await expect(scale).not.toHaveText(overview)
    await expectViewportToDiffer(page, before, 2)
  })

  test('A6 CATCH multi-group tissue ANN show all and hide all', async ({
    page,
  }) => {
    /** openViewer can spend up to 2× its timeout (panel + tiles) */
    test.setTimeout(300_000)
    await openViewer(
      page,
      seriesUrl({ study: catchAnn.study, series: catchAnn.ann }),
      { timeout: 120_000 },
    )
    await expectTissueRendered(page)
    const groups = await section(slidePanel(page), 'Annotation groups')
    const bulk = groups.getByRole('group', {
      name: 'Visibility of annotation groups',
    })
    const showAll = bulk.getByRole('button', {
      name: 'Show all annotation groups',
    })
    const hideAll = bulk.getByRole('button', {
      name: 'Hide all annotation groups',
    })
    /**
     * Deep-link turns every group of the series on after derived data loads.
     * Wait for that settled state before reading N — tiles can settle first.
     */
    await expect(showAll).toBeDisabled({ timeout: 60_000 })
    const counts = /(\d+) of (\d+) visible/.exec(await bulk.innerText())
    expect(counts, 'visible/total group counts').not.toBeNull()
    const total = counts?.[2] ?? '0'
    expect(Number(total)).toBeGreaterThan(1)
    await expect(bulk).toContainText(`${total} of ${total} visible`)
    await hideAll.click()
    await expect(bulk).toContainText(`0 of ${total} visible`)
    await showAll.click()
    await expect(bulk).toContainText(`${total} of ${total} visible`)
  })
})

/** Each test leaves every ROI visible, so the three share one loaded slide */
test.describe('SR annotations', () => {
  test.describe.configure({ mode: 'serial' })
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await newSharedPage(browser)
    await openViewer(page, srUrl)
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('R1 SR link lists its 9 ROIs with findings', async () => {
    const rois = await section(slidePanel(page), 'Annotations')
    for (let roi = 1; roi <= 9; roi++) {
      await expect(
        rois.getByRole('button', { name: `Show ROI ${roi}`, exact: true }),
      ).toBeVisible()
    }
    await expect(rois.getByText(/Necrosis/).first()).toBeVisible()
  })

  test('R2 hide all ROIs and hide a single ROI', async () => {
    const rois = await section(slidePanel(page), 'Annotations')
    const before = await captureSettledViewport(page)
    await rois.getByRole('button', { name: 'Hide all annotations' }).click()
    await expect(rois.getByText('0 of 9 visible')).toBeVisible()
    await expectViewportToDiffer(page, before, 0.3)

    await rois.getByRole('button', { name: 'Show all annotations' }).click()
    const roi1 = rois.getByRole('button', { name: 'Show ROI 1', exact: true })
    await roi1.click()
    await expect(rois.getByText('8 of 9 visible')).toBeVisible()
    await roi1.click()
    await expect(rois.getByText('9 of 9 visible')).toBeVisible()
  })

  test('R3 annotation categories hide every ROI of a finding', async () => {
    const categories = await section(slidePanel(page), 'Annotation categories')
    await expect(
      categories.getByRole('button', { name: /category, \d+ annotations/ }),
    ).not.toHaveCount(0)
    await categories
      .getByRole('button', { name: /^Necrosis, 4 annotations/ })
      .click()
    const showAll = page.getByRole('switch', { name: 'Show all Necrosis' })
    await expect(showAll).toBeChecked()
    await showAll.click()
    await expect(showAll).not.toBeChecked()
    await page.keyboard.press('Escape')
    const rois = await section(slidePanel(page), 'Annotations')
    await expect(rois.getByText('5 of 9 visible')).toBeVisible()
  })
})
