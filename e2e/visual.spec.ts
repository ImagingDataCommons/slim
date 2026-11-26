import { expect } from '@playwright/test'

import { test } from './fixtures'
import {
  captureSettledViewport,
  expectSettledViewportScreenshot,
  expectTissueRendered,
  openViewer,
  overrideConfig,
  section,
  setGammaCorrection,
  slidePanel,
  viewportDiff,
  waitForDeepLinkedLayer,
} from './helpers'
import { labelmap, serveLabelmap } from './labelmap'
import { seriesUrl, studies } from './studies'

const { he, tcgaRead, tcgaLuad, tcgaGbm, rmsSr, boneMarrow, htanHms } = studies

/** CyCIF + Advanced Blending PR — gamma on/off paints different palette colors */
const gammaBaselineUrl = seriesUrl({
  study: htanHms.study,
  series: htanHms.advancedBlendingPr,
  state: htanHms.advancedBlendingState,
})

/**
 * Curated viewport baselines for modality smoke. Interaction coverage stays
 * in the other specs; these catch blank canvases and wrong overlay chrome.
 * Update baselines on Linux (same as CI): `pnpm test:e2e:visual:update`.
 */
test.describe('Visual smoke', () => {
  test('VS1 H&E brightfield', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
    await expectTissueRendered(page)
    await expectSettledViewportScreenshot(page, 'vs1-he-brightfield')
  })

  test('VS2 fractional TIL SEG', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({
        study: tcgaRead.study,
        series: tcgaRead.fractionalTilSeg,
      }),
    )
    await expectTissueRendered(page)
    /** The capture must include the overlay the link turned on */
    await waitForDeepLinkedLayer(page, 'Segmentations')
    await expectSettledViewportScreenshot(page, 'vs2-fractional-til-seg')
  })

  test('VS3 binary TIL SEG', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({
        study: tcgaLuad.study,
        series: tcgaLuad.binaryTilSeg,
      }),
    )
    await expectTissueRendered(page)
    /** The capture must include the overlay the link turned on */
    await waitForDeepLinkedLayer(page, 'Segmentations')
    await expectSettledViewportScreenshot(page, 'vs3-binary-til-seg')

    /**
     * The binary segment covers little of the overview, so the screenshot
     * matches its baseline even when the segment is not drawn at all.
     * Hiding a drawn segment changes the settled viewport by about 0.27,
     * and showing it again changes it back; when nothing is drawn, both
     * stay near 0.005 (rendering noise). Both must change, so a late
     * redraw of the slide cannot stand in for the segment.
     */
    const segments = await section(slidePanel(page), 'Segmentations')
    const name = await segments
      .getByRole('button', { name: /^Show (?!all)/, pressed: true })
      .first()
      .getAttribute('aria-label')
    const toggle = segments
      .getByRole('button', { name: name ?? '', exact: true })
      .first()
    const shown = await captureSettledViewport(page)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    const hidden = await captureSettledViewport(page)
    expect(
      await viewportDiff(page, shown, hidden),
      'hiding the binary segment changes the viewport',
    ).toBeGreaterThan(0.05)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const shownAgain = await captureSettledViewport(page)
    expect(
      await viewportDiff(page, hidden, shownAgain),
      'showing the binary segment again changes the viewport',
    ).toBeGreaterThan(0.05)
  })

  test('VS4 parametric map', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({
        study: tcgaGbm.study,
        series: tcgaGbm.parametricMap,
      }),
    )
    await expectTissueRendered(page)
    /** The capture must include the overlay the link turned on */
    await waitForDeepLinkedLayer(page, 'Parametric maps')
    await expectSettledViewportScreenshot(page, 'vs4-parametric-map')
  })

  test('VS5 SR ROIs', async ({ page }) => {
    await openViewer(page, seriesUrl({ study: rmsSr.study, series: rmsSr.sr }))
    await expectTissueRendered(page)
    await expectSettledViewportScreenshot(page, 'vs5-sr-rois')
  })

  test('VS6 bone marrow ANN', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({ study: boneMarrow.study, series: boneMarrow.ann }),
    )
    await expectTissueRendered(page)
    await expectSettledViewportScreenshot(page, 'vs6-bone-marrow-ann')
  })

  test('VS7 H&E light theme', async ({ page }) => {
    await overrideConfig(page, { mode: 'light' })
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
    await expectTissueRendered(page)
    await expectSettledViewportScreenshot(page, 'vs7-he-light')
  })

  test('VS8 gamma correction on (Advanced Blending PR)', async ({ page }) => {
    /** CyCIF + multi-channel PR; openViewer can spend 2× timeout waiting */
    test.setTimeout(420_000)
    await openViewer(page, gammaBaselineUrl, { timeout: 180_000 })
    await expectTissueRendered(page, 3)
    await setGammaCorrection(page, true)
    await expectSettledViewportScreenshot(page, 'vs8-gamma-on')
  })

  test('VS9 gamma correction off (Advanced Blending PR)', async ({ page }) => {
    test.setTimeout(420_000)
    await openViewer(page, gammaBaselineUrl, { timeout: 180_000 })
    await expectTissueRendered(page, 3)
    await setGammaCorrection(page, false)
    await expectSettledViewportScreenshot(page, 'vs9-gamma-off')
  })

  test('VS10 LABELMAP SEG without its background segment', async ({ page }) => {
    /** Synthetic LABELMAP served into the RMS study (e2e/labelmap.ts) */
    await serveLabelmap(page)
    await openViewer(
      page,
      seriesUrl({ study: labelmap.study, series: labelmap.series }),
    )
    await expectTissueRendered(page)
    await waitForDeepLinkedLayer(page, 'Segmentations')
    /**
     * "Show all" is how a background segment got drawn: four bands inside
     * an ellipse are expected, a background would flood the rest
     */
    const segments = await section(slidePanel(page), 'Segmentations')
    await segments.getByRole('button', { name: 'Hide all segments' }).click()
    await segments.getByRole('button', { name: 'Show all segments' }).click()
    await expectSettledViewportScreenshot(page, 'vs10-labelmap-seg')
  })
})
