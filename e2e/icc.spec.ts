import { expect } from '@playwright/test'

import { test } from './fixtures'
import {
  blockIccProfiles,
  captureCorrectedViewport,
  captureSettledViewport,
  captureViewport,
  delayIccProfiles,
  iccSlideUrl,
  openDisplayOptions,
  openViewer,
  SAME_IMAGE,
  section,
  slidePanel,
  statusPill,
  viewportColorDiff,
} from './helpers'

test.describe('ICC color profile', () => {
  test('ICC1 color corrects the first view however the profile and tiles race', async ({
    page,
  }) => {
    await openViewer(page, iccSlideUrl)
    const corrected = await captureCorrectedViewport(page)

    /** Same context, so the same viewport and test setup */
    const capture = async (
      setUp: (otherPage: typeof page) => Promise<void>,
    ): Promise<Buffer> => {
      const otherPage = await page.context().newPage()
      try {
        await setUp(otherPage)
        await openViewer(otherPage, iccSlideUrl)
        return await captureCorrectedViewport(otherPage)
      } finally {
        await otherPage.close()
      }
    }
    const uncorrected = await capture(blockIccProfiles)
    const late = await capture((otherPage) => delayIccProfiles(otherPage, 5000))

    expect(
      await viewportColorDiff(page, corrected, uncorrected),
      'the first view is color corrected',
    ).toBeGreaterThan(SAME_IMAGE * 2)
    expect(
      await viewportColorDiff(page, corrected, late),
      'tiles drawn before the profile arrived are corrected too',
    ).toBeLessThan(SAME_IMAGE)
  })

  test('ICC4 the ICC profiles switch removes and restores the correction', async ({
    page,
  }) => {
    const uncorrectedPage = await page.context().newPage()
    let uncorrected: Buffer
    try {
      await blockIccProfiles(uncorrectedPage)
      await openViewer(uncorrectedPage, iccSlideUrl)
      uncorrected = await captureCorrectedViewport(uncorrectedPage)
    } finally {
      await uncorrectedPage.close()
    }
    await openViewer(page, iccSlideUrl)
    const corrected = await captureCorrectedViewport(page)

    const paths = await openDisplayOptions(
      await section(slidePanel(page), 'Optical paths'),
    )
    const icc = paths.getByRole('switch', { name: 'ICC profiles' })
    await icc.click()
    await expect(icc).not.toBeChecked()
    await expect
      .poll(
        async () =>
          viewportColorDiff(page, uncorrected, await captureViewport(page)),
        { message: 'switched off, the slide is uncorrected', timeout: 60_000 },
      )
      .toBeLessThan(SAME_IMAGE)

    await icc.click()
    await expect(icc).toBeChecked()
    await expect
      .poll(
        async () =>
          viewportColorDiff(page, corrected, await captureViewport(page)),
        { message: 'switched on, the slide is corrected', timeout: 60_000 },
      )
      .toBeLessThan(SAME_IMAGE)
  })

  test('ICC3 announces the profile until the corrected view is drawn', async ({
    page,
  }) => {
    await delayIccProfiles(page, 5000)
    await page.goto(iccSlideUrl)

    await expect(statusPill(page, 'Applying color profile')).toBeVisible({
      timeout: 60_000,
    })
    await expect(statusPill(page, 'Applying color profile')).toHaveCount(0, {
      timeout: 60_000,
    })
    /** Gone only once drawn: the view no longer changes afterwards */
    const atRemoval = await captureViewport(page)
    const settled = await captureSettledViewport(page, { quietMs: 1000 })
    expect(await viewportColorDiff(page, atRemoval, settled)).toBeLessThan(
      SAME_IMAGE,
    )
  })
})
