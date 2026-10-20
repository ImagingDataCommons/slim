import { expect, type Page } from '@playwright/test'

import { newSharedPage, test } from './fixtures'
import {
  captureSettledViewport,
  expectTissueRendered,
  expectViewportToDiffer,
  expectViewportToMatch,
  openDisplayOptions,
  openViewer,
  section,
  slidePanel,
} from './helpers'
import { seriesUrl, studies } from './studies'

const { htanImc, htanHms, tcgaGbm, boneMarrow } = studies
const imcUrl = seriesUrl({ study: htanImc.study, series: htanImc.imcSlide })

/** Each test puts the channels back the way it found them, so they share a slide */
test.describe('Optical paths on one multiplexed slide', () => {
  test.describe.configure({ mode: 'serial' })
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await newSharedPage(browser)
    await openViewer(page, imcUrl)
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('O1 multiplexed slide lists channels with window and visibility controls', async () => {
    await expectTissueRendered(page, 3)
    const paths = await section(slidePanel(page), 'Optical paths')
    await expect(
      slidePanel(page).getByRole('button', { name: /^Optical paths 28$/ }),
    ).toBeVisible()
    await expect(
      paths.getByRole('slider', { name: 'SMA Lower limit' }),
    ).toBeVisible()
    await expect(
      paths.getByRole('slider', { name: 'SMA Upper limit' }),
    ).toBeVisible()

    const before = await captureSettledViewport(page)
    const sma = paths.getByRole('button', { name: 'Show SMA' })
    await sma.click()
    await expect(sma).toHaveAttribute('aria-pressed', 'false')
    await expectViewportToDiffer(page, before, 0.5)
    await sma.click()
    await expect(sma).toHaveAttribute('aria-pressed', 'true')
  })

  test('O2 channels can be removed and added back', async () => {
    const paths = await section(slidePanel(page), 'Optical paths')
    await paths.getByRole('button', { name: 'Remove SMA' }).click()
    await expect(paths.getByRole('button', { name: 'Show SMA' })).toHaveCount(0)
    await paths.getByRole('combobox', { name: 'Optical path to add' }).click()
    await page.getByRole('option', { name: /SMA/ }).click()
    await paths.getByRole('button', { name: 'Add optical path' }).click()
    await expect(paths.getByRole('button', { name: 'Show SMA' })).toBeVisible()
  })

  test('O3 presentation state applies, updates the URL and resets', async () => {
    const states = await section(slidePanel(page), 'Presentation states')
    const before = await captureSettledViewport(page)
    const picker = states.getByRole('combobox', { name: 'Presentation state' })
    await picker.click()
    const options = page.getByRole('option')
    expect(await options.count()).toBeGreaterThan(1)
    await options.nth(1).click()
    await expect(page).toHaveURL(/[?&]state=[\d.]+/)
    await expectViewportToDiffer(page, before, 0.5)

    await states
      .getByRole('button', { name: 'Reset presentation state' })
      .click()
    await expect(page).not.toHaveURL(/state=/)
  })

  test('O7 channel color and opacity change the image', async () => {
    const paths = await section(slidePanel(page), 'Optical paths')
    await paths
      .getByRole('button', { name: 'Display settings for SMA' })
      .click()
    const settings = page.getByRole('dialog')
    const before = await captureSettledViewport(page)

    const opacity = settings.getByRole('spinbutton', { name: 'Opacity value' })
    const initialOpacity = await opacity.inputValue()
    await opacity.fill('0')
    await opacity.press('Enter')
    await expectViewportToDiffer(page, before, 0.3)
    await opacity.fill(initialOpacity)
    await opacity.press('Enter')
    await expectViewportToMatch(page, before, 0.3)

    const red = settings.getByRole('spinbutton', { name: 'Red value' })
    const initialRed = await red.inputValue()
    await red.fill(initialRed === '0' ? '255' : '0')
    await red.press('Enter')
    await expectViewportToDiffer(page, before, 0.1)
    await red.fill(initialRed)
    await red.press('Enter')
    await page.keyboard.press('Escape')
    await expect(settings).toBeHidden()
  })

  test('O9 switching between presentation states updates the URL and the image', async () => {
    const states = await section(slidePanel(page), 'Presentation states')
    const picker = states.getByRole('combobox', { name: 'Presentation state' })
    await picker.click()
    await page.getByRole('option').nth(0).click()
    await expect(page).toHaveURL(/[?&]state=[\d.]+/)
    const firstUrl = page.url()
    const first = await captureSettledViewport(page)

    await picker.click()
    await page.getByRole('option').nth(1).click()
    await expect(page).not.toHaveURL(firstUrl)
    await expect(page).toHaveURL(/[?&]state=[\d.]+/)
    await expectViewportToDiffer(page, first, 0.5)

    await states
      .getByRole('button', { name: 'Reset presentation state' })
      .click()
    await expect(page).not.toHaveURL(/state=/)
  })
})

test.describe('Optical paths and display options', () => {
  test('O4 presentation state from the URL is applied on load', async ({
    page,
  }) => {
    await openViewer(page, imcUrl)
    const states = await section(slidePanel(page), 'Presentation states')
    await states.getByRole('combobox', { name: 'Presentation state' }).click()
    await page.getByRole('option').nth(1).click()
    await expect(page).toHaveURL(/state=/)
    const label = await states
      .getByRole('combobox', { name: 'Presentation state' })
      .innerText()

    await page.reload()
    await expect(slidePanel(page)).toBeVisible({ timeout: 60_000 })
    const reloaded = await section(slidePanel(page), 'Presentation states')
    await expect(
      reloaded.getByRole('combobox', { name: 'Presentation state' }),
    ).toHaveText(label)
  })

  test('O10 an unknown presentation state in the URL falls back to the default', async ({
    page,
  }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (error) => pageErrors.push(error))
    await openViewer(page, `${imcUrl}?state=1.2.3.4.5`)
    await expectTissueRendered(page, 3)
    const states = await section(slidePanel(page), 'Presentation states')
    await expect(
      states.getByRole('combobox', { name: 'Presentation state' }),
    ).toHaveText('Default')
    expect(pageErrors).toEqual([])
  })

  /** Gamma correction applies to palette colors, so it shows on the parametric map */
  test('O8 gamma correction changes palette colored overlays', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: tcgaGbm.study, series: tcgaGbm.parametricMap }),
    )
    const paths = await openDisplayOptions(
      await section(slidePanel(page), 'Optical paths'),
    )
    const gamma = paths.getByRole('switch', { name: 'Gamma correction' })
    await expect(gamma).toBeChecked()
    const before = await captureSettledViewport(page)
    await gamma.click()
    await expect(gamma).not.toBeChecked()
    await expectViewportToDiffer(page, before, 0.1)
  })

  test('O5 ICC profile toggle changes brightfield colors', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({ study: tcgaGbm.study, series: tcgaGbm.dx1Slide }),
    )
    const paths = await openDisplayOptions(
      await section(slidePanel(page), 'Optical paths'),
    )
    const icc = paths.getByRole('switch', { name: 'ICC profiles' })
    await expect(icc).toBeChecked()
    const before = await captureSettledViewport(page)
    await icc.click()
    await expect(icc).not.toBeChecked()
    await expectViewportToDiffer(page, before, 0.2)
  })

  test('O6 clustering threshold accepts decimals', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({ study: boneMarrow.study, series: boneMarrow.ann }),
    )
    const groups = await openDisplayOptions(
      await section(slidePanel(page), 'Annotation groups'),
    )
    const clustering = groups.getByRole('switch', { name: 'Clustering' })
    if (!(await clustering.isChecked())) await clustering.click()
    const threshold = groups.getByRole('textbox', {
      name: 'Clustering pixel size threshold',
    })
    await threshold.fill('0.0005')
    await threshold.blur()
    await expect(threshold).toHaveValue('0.0005')
  })

  /**
   * Deep-link to an Advanced Blending PR series (gallery P9). Slim resolves the
   * referenced fluorescence slide; applying that PR from the series URL is still
   * a TODO (showDerivedDataset treats it as unsupported).
   */
  test('O11 Advanced Blending PR series link opens the referenced slide', async ({
    page,
  }) => {
    /** openViewer can spend up to 2× its timeout (panel + tiles) on CyCIF */
    test.setTimeout(420_000)
    await openViewer(
      page,
      seriesUrl({
        study: htanHms.study,
        series: htanHms.advancedBlendingPr,
      }),
      { timeout: 180_000 },
    )
    await expectTissueRendered(page, 3)
    const paths = await section(slidePanel(page), 'Optical paths')
    await expect(
      slidePanel(page).getByRole('button', { name: /^Optical paths \d+$/ }),
    ).toBeVisible()
    await expect(
      paths.getByRole('button', { name: /^Show / }).first(),
    ).toBeVisible()
    const states = await section(slidePanel(page), 'Presentation states')
    await expect(
      states.getByRole('combobox', { name: 'Presentation state' }),
    ).toBeVisible()
  })
})
