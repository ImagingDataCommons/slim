import { test } from './fixtures'
import {
  expectSettledViewportScreenshot,
  expectTissueRendered,
  openViewer,
  overrideConfig,
  setGammaCorrection,
} from './helpers'
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
    await expectSettledViewportScreenshot(page, 'vs3-binary-til-seg')
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
})
