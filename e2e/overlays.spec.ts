import { expect, type Page, test } from '@playwright/test'

import {
  captureViewport,
  expectTissueRendered,
  mainViewportCenter,
  openViewer,
  section,
  slidePanel,
  viewportDiff,
  waitForTilesSettled,
} from './helpers'
import { seriesUrl, studies } from './studies'

const { tcgaRead, tcgaGbm, rmsSr, boneMarrow } = studies

/** Waits for the DMV layer to repaint after a visibility change */
async function settle(page: Page): Promise<Buffer> {
  await page.waitForTimeout(1500)
  await waitForTilesSettled(page)
  return captureViewport(page)
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
    await openViewer(page, seriesUrl({ study: rmsSr.study, series: rmsSr.sr }))
    const segments = await section(slidePanel(page), 'Segmentations')
    const before = await settle(page)
    await segments.getByRole('button', { name: 'Show all segments' }).click()
    await expect(segments.getByText('4 of 4 visible')).toBeVisible()
    const shown = await settle(page)
    expect(await viewportDiff(page, before, shown)).toBeGreaterThan(1)

    await segments.getByRole('button', { name: 'Hide all segments' }).click()
    await expect(segments.getByText('0 of 4 visible')).toBeVisible()
    const hidden = await settle(page)
    expect(await viewportDiff(page, before, hidden)).toBeLessThan(1)
  })

  test('S3 a single segment toggles and its opacity changes the overlay', async ({
    page,
  }) => {
    await openViewer(page, seriesUrl({ study: rmsSr.study, series: rmsSr.sr }))
    const segments = await section(slidePanel(page), 'Segmentations')
    const toggle = segments.getByRole('button', { name: 'Show STROMA' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const full = await settle(page)

    const opacity = segments.getByRole('slider', { name: 'Opacity of STROMA' })
    await opacity.focus()
    for (let step = 0; step < 10; step++) await page.keyboard.press('ArrowLeft')
    const faded = await settle(page)
    expect(await viewportDiff(page, full, faded)).toBeGreaterThan(0.5)
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
    const before = await settle(page)
    await toggle.click()
    await expect(toggle).toHaveAttribute(
      'aria-pressed',
      wasVisible ? 'false' : 'true',
    )
    const after = await settle(page)
    expect(await viewportDiff(page, before, after)).toBeGreaterThan(0.5)
  })
})

test.describe('Annotation groups', () => {
  test('A1 ANN link loads nuclei polygons that hide with their toggle', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    const bulk: number[] = []
    page.on('response', (response) => {
      if (response.url().includes('/bulk')) bulk.push(response.status())
    })
    await openViewer(
      page,
      seriesUrl({ study: tcgaRead.study, series: tcgaRead.nucleiAnn }),
    )
    const groups = await section(slidePanel(page), 'Annotation groups')
    const toggle = groups.getByRole('button', { name: 'Show Nuclei' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => bulk.includes(200), { timeout: 90_000 }).toBe(true)

    /** ~508k polygons arrive progressively; toggling earlier leaves clusters */
    await page.waitForTimeout(25_000)
    const center = await mainViewportCenter(page)
    await page.mouse.move(center.x, center.y)
    for (let step = 0; step < 8; step++) {
      await page.mouse.wheel(0, -300)
      await page.waitForTimeout(250)
    }
    const shown = await settle(page)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    const hidden = await settle(page)
    expect(await viewportDiff(page, shown, hidden)).toBeGreaterThan(2)
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
})

test.describe('SR annotations', () => {
  test('R1 SR link lists its 9 ROIs with findings', async ({ page }) => {
    await openViewer(page, seriesUrl({ study: rmsSr.study, series: rmsSr.sr }))
    const rois = await section(slidePanel(page), 'Annotations')
    for (let roi = 1; roi <= 9; roi++) {
      await expect(
        rois.getByRole('button', { name: `Show ROI ${roi}`, exact: true }),
      ).toBeVisible()
    }
    await expect(rois.getByText(/Necrosis/).first()).toBeVisible()
  })

  test('R2 hide all ROIs and hide a single ROI', async ({ page }) => {
    await openViewer(page, seriesUrl({ study: rmsSr.study, series: rmsSr.sr }))
    const rois = await section(slidePanel(page), 'Annotations')
    const before = await settle(page)
    await rois.getByRole('button', { name: 'Hide all annotations' }).click()
    await expect(rois.getByText('0 of 9 visible')).toBeVisible()
    const hidden = await settle(page)
    expect(await viewportDiff(page, before, hidden)).toBeGreaterThan(0.3)

    await rois.getByRole('button', { name: 'Show all annotations' }).click()
    await rois.getByRole('button', { name: 'Show ROI 1', exact: true }).click()
    await expect(rois.getByText('8 of 9 visible')).toBeVisible()
  })

  test('R3 annotation categories hide every ROI of a finding', async ({
    page,
  }) => {
    await openViewer(page, seriesUrl({ study: rmsSr.study, series: rmsSr.sr }))
    const categories = await section(slidePanel(page), 'Annotation categories')
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
