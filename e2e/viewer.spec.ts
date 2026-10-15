import { expect, test } from '@playwright/test'

import {
  captureViewport,
  expandSection,
  expectTissueRendered,
  mainViewportCenter,
  openViewer,
  sectionButton,
  slidePanel,
  studyPanel,
  viewportDiff,
  waitForTilesSettled,
} from './helpers'
import { seriesUrl, studies, studyUrl } from './studies'

const { he, jpeg2000 } = studies

test.describe('Slide viewer', () => {
  test('V1 study link redirects to its first slide and renders tissue', async ({
    page,
  }) => {
    await page.goto(`${studyUrl(he.study)}?probe=1#hash`)
    await expect(page).toHaveURL(
      new RegExp(`/studies/${he.study}/series/[\\d.]+\\?probe=1#hash$`),
    )
    await expect(slidePanel(page)).toBeVisible({ timeout: 60_000 })
    await waitForTilesSettled(page)
    await expectTissueRendered(page)
  })

  test('V2 zoom buttons fetch higher resolution tiles and fit restores', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
    const fitted = await captureViewport(page)
    const frames: string[] = []
    page.on('response', (response) => {
      if (response.url().includes('/frames/')) frames.push(response.url())
    })

    const zoomIn = page.getByRole('button', { name: 'Zoom in' })
    for (let step = 0; step < 4; step++) await zoomIn.click()
    await waitForTilesSettled(page)
    expect(frames.length, 'new frame requests after zooming').toBeGreaterThan(2)
    const zoomed = await captureViewport(page)
    expect(await viewportDiff(page, fitted, zoomed)).toBeGreaterThan(5)

    await page.getByRole('button', { name: 'Fit to view' }).click()
    await waitForTilesSettled(page)
    expect(
      await viewportDiff(page, fitted, await captureViewport(page)),
    ).toBeLessThan(5)
  })

  test('V3 overlays show scale, magnification and cursor position in mm', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
    const main = page.getByRole('main')
    await expect(main.getByText(/\d+(\.\d+)?× · [\d.]+ µm\/px/)).toBeVisible()
    await expect(main.getByText('x — · y — mm')).toBeVisible()
    const center = await mainViewportCenter(page)
    await page.mouse.move(center.x, center.y)
    await page.mouse.move(center.x + 20, center.y + 10, { steps: 5 })
    await expect(main.getByText(/x -?[\d.]+ · y -?[\d.]+ mm/)).toBeVisible()
  })

  test('V4 slide list switches slides and updates the URL', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
    const slides = page.getByRole('list', { name: 'Slides' })
    await expect(slides.getByRole('listitem')).toHaveCount(6)
    /** IDC returns series in no fixed order */
    const other = slides.getByRole('button', { pressed: false }).first()
    const [slideId] = (await other.innerText()).split('\n')
    await other.click()
    await expect(
      slides.getByRole('button', { name: new RegExp(`^${slideId} `) }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page).not.toHaveURL(new RegExp(he.firstSlide))
    await waitForTilesSettled(page)
    await expectTissueRendered(page)
  })

  test('V5 left panel shows patient, study and slide count', async ({
    page,
  }) => {
    await openViewer(page, studyUrl(he.study))
    const panel = studyPanel(page)
    await expect(panel.getByText('Patient ID')).toBeVisible()
    await expect(panel.getByText(he.patientId).first()).toBeVisible()
    await expect(panel.getByText('Histopathology')).toBeVisible()
    await expect(sectionButton(panel, 'Clinical trial')).toBeVisible()
    await expect(page.getByRole('banner')).toContainText(he.patientId)
  })

  test('V6 right panel shows label, specimen, equipment and optical path', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: he.study, series: he.firstSlide }),
    )
    const panel = slidePanel(page)
    await expect(sectionButton(panel, 'Slide label')).toBeVisible()
    await expect(panel.getByText('C3L-00965-01')).toBeVisible()
    await expect(panel.getByText('Lung')).toBeVisible()
    await expect(
      panel.getByText('water soluble eosin stain').first(),
    ).toBeVisible()
    await expandSection(panel, 'Equipment')
    await expect(panel.getByText(/Manufacturer/i).first()).toBeVisible()
    await expect(
      panel.getByRole('button', { name: 'Show Brightfield' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('V7 both side panels collapse and reopen', async ({ page }) => {
    await openViewer(page, studyUrl(he.study))
    const toggleStudy = page.getByRole('button', { name: 'Toggle study panel' })
    const toggleSlide = page.getByRole('button', { name: 'Toggle slide panel' })
    await toggleStudy.click()
    await toggleSlide.click()
    await expect(studyPanel(page)).toBeHidden()
    await expect(slidePanel(page)).toBeHidden()
    await toggleStudy.click()
    await toggleSlide.click()
    await expect(studyPanel(page)).toBeVisible()
    await expect(slidePanel(page)).toBeVisible()
  })

  test('V8 footer reports tile progress and memory', async ({ page }) => {
    await openViewer(page, studyUrl(he.study))
    const footer = page.locator('footer').filter({ hasText: 'Tiles' })
    await expect(footer).toContainText(/Tiles [\d,]+ \/ [\d,]+/)
    await expect(footer).toContainText(/Memory/)
    await expect(footer).not.toContainText('failed')
  })

  test('V9 unknown study and unknown series show an error page', async ({
    page,
  }) => {
    await page.goto(studyUrl('1.2.3.4.5.404'))
    await expect(
      page.getByText(/Couldn't load this study|No slides found/),
    ).toBeVisible({ timeout: 60_000 })
    await page.goto(seriesUrl({ study: he.study, series: '1.2.3.4.5.404' }))
    await expect(page.getByText('Series not found')).toBeVisible({
      timeout: 60_000,
    })
  })

  test('V10 JPEG 2000 slide renders', async ({ page }) => {
    await openViewer(
      page,
      seriesUrl({ study: jpeg2000.study, series: jpeg2000.slide }),
    )
    await expectTissueRendered(page)
  })
})

const smokeStudies = Object.entries(studies).map(([name, value]) => ({
  name,
  study: value.study,
}))

test.describe('Every test study opens cleanly', () => {
  for (const { name, study } of smokeStudies) {
    test(`V11 ${name} loads without page errors or failed tiles`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await openViewer(page, studyUrl(study))
      await expect(
        page.locator('footer').filter({ hasText: 'Tiles' }),
      ).not.toContainText('failed')
      expect(errors).toEqual([])
    })
  }
})
