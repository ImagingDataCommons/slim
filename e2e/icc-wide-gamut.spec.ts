import { expect } from '@playwright/test'

import { test } from './fixtures'
import {
  captureViewport,
  delayIccProfiles,
  iccSlideUrl,
  slidePanel,
  statusPill,
  viewportStats,
} from './helpers'

/**
 * Display P3, as on most Macs; DMV converts tiles to this color space. The
 * launch options apply to the whole file, so these tests live apart.
 */
test.use({
  launchOptions: {
    args: [
      '--enable-unsafe-swiftshader',
      '--force-color-profile=display-p3-d65',
    ],
  },
})

/**
 * Luminance spread of the drawn slide: a blank viewport measures under 10,
 * this slide about 95
 */
const TISSUE_SPREAD = 30

test.describe('ICC color profile on a wide-gamut display', () => {
  test('ICC2 keeps the slide on screen while the profile is applied', async ({
    page,
  }) => {
    await delayIccProfiles(page, 5000)
    await page.goto(iccSlideUrl)
    await expect(slidePanel(page)).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.ol-viewport').first()).toBeVisible({
      timeout: 60_000,
    })

    /** Samples the viewport until the corrected view has been drawn */
    const spreads: number[] = []
    const pill = statusPill(page, 'Applying color profile')
    const deadline = Date.now() + 90_000
    let hasAppeared = false
    while (Date.now() < deadline) {
      const spread = (await viewportStats(page, await captureViewport(page)))
        .stdDev
      if (spread > TISSUE_SPREAD) hasAppeared = true
      if (hasAppeared) spreads.push(spread)
      if (hasAppeared && (await pill.count()) === 0 && spreads.length > 5) {
        break
      }
      await page.waitForTimeout(100)
    }

    expect(hasAppeared, 'the slide was drawn').toBe(true)
    expect(
      Math.min(...spreads),
      `lowest spread once drawn, of ${spreads.length} samples`,
    ).toBeGreaterThan(TISSUE_SPREAD)
  })
})
