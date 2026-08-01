import { expect, test } from '@playwright/test'

import {
  GROUP_NAME,
  STUDY_UID,
  deckDrawnPixelCount,
  expandAnnotationGroups,
  mapClip,
  setGroupVisibility,
  usedHeapMB,
  waitForAnnotationsCleared,
  waitForAnnotationsDrawn,
  waitForAnnotationsStable,
  waitForSlide,
} from './helpers'

/**
 * Visual-regression + smoke coverage for the deck.gl bulk-annotation renderer.
 *
 * The default target is a ~396k-polygon "Nuclei" group (see helpers.ts). The
 * suite asserts three things that matter for the renderer:
 *   1. A large group loads and paints without exhausting the JS heap (the OL
 *      Feature pipeline this replaced OOM'd on groups this size).
 *   2. The annotation overlay matches a committed screenshot baseline.
 *   3. Hiding the group frees the overlay.
 *
 * Screenshots are clipped to the map viewport so the volatile memory footer
 * and sidebar text never enter the comparison.
 */
test.describe('bulk annotations (deck.gl overlay)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/studies/${STUDY_UID}`)
    await waitForSlide(page)
    await expandAnnotationGroups(page)
  })

  test('renders a large annotation group without exhausting memory', async ({
    page,
  }) => {
    const heapBefore = await usedHeapMB(page)

    await setGroupVisibility(page, GROUP_NAME, true)

    const drawnPixels = await waitForAnnotationsDrawn(page)
    expect(drawnPixels).toBeGreaterThan(500)

    // Wait for progressive streaming to finish so the whole-slide overlay
    // (the deterministic screenshot target) reflects the complete group.
    await waitForAnnotationsStable(page)

    const heapAfter = await usedHeapMB(page)
    if (heapBefore >= 0 && heapAfter >= 0) {
      // Guardrail against a regression to the old multi-GB / OOM behavior.
      // ~396k polygons decode to a few hundred MB; 1500 MB leaves headroom
      // without letting a runaway leak pass.
      expect(heapAfter).toBeLessThan(1500)
    }

    // The whole-slide fit is fully deterministic (it depends only on the image
    // dimensions and viewport, not on network/streaming timing or pointer
    // position), and after full load the overlay renders the entire group via
    // the centroid/line LOD tiers — so it is a stable visual-regression target.
    await page
      .waitForLoadState('networkidle', { timeout: 60_000 })
      .catch(() => undefined)
    await expect(page).toHaveScreenshot('nuclei-whole-slide.png', {
      clip: await mapClip(page),
      /**
       * Playwright waits for two consecutive identical frames; give slow WSI
       * tile streaming room to finish before the comparison gives up.
       */
      timeout: 120_000,
    })
  })

  test('hides an annotation group on toggle-off', async ({ page }) => {
    await setGroupVisibility(page, GROUP_NAME, true)
    await waitForAnnotationsDrawn(page)

    await setGroupVisibility(page, GROUP_NAME, false)

    await waitForAnnotationsCleared(page)
    expect(await deckDrawnPixelCount(page)).toBeLessThan(500)
  })
})
