import { expect, type Locator, type Page } from '@playwright/test'

export interface ViewportStats {
  mean: number
  stdDev: number
}

export function slidePanel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Slide panel' })
}

export function studyPanel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Study panel' })
}

/** Collapsible panel section header, e.g. "Segmentations" or "Specimens 1" */
export function sectionButton(panel: Locator, title: string): Locator {
  return panel.getByRole('button', { name: new RegExp(`^${title}( \\d+)?$`) })
}

/** Opens a collapsed panel section the way a user clicks its title */
export async function expandSection(
  panel: Locator,
  title: string,
): Promise<void> {
  const button = sectionButton(panel, title)
  await expect(button).toBeVisible()
  if ((await button.getAttribute('aria-expanded')) !== 'true') {
    await button.click()
  }
  await expect(button).toHaveAttribute('aria-expanded', 'true')
}

/** Expands a section and returns its content, so same-named layers don't clash */
export async function section(panel: Locator, title: string): Promise<Locator> {
  await expandSection(panel, title)
  const contentId = await sectionButton(panel, title).getAttribute(
    'aria-controls',
  )
  expect(contentId, `${title} content id`).not.toBeNull()
  return panel.page().locator(`[id="${contentId}"]`)
}

/**
 * Waits for the footer tile counter to report every requested tile as loaded
 * and to stay that way. Use captureSettledViewport when comparing pixels.
 */
export async function waitForTilesSettled(page: Page): Promise<void> {
  const footer = page.locator('footer').filter({ hasText: 'Tiles' })
  let previous = ''
  let stableSince = Date.now()
  await expect
    .poll(
      async () => {
        const text = (await footer.innerText()).replace(/\s+/g, ' ')
        const match = /Tiles ([\d,]+) \/ ([\d,]+)/.exec(text)
        if (match === null) return false
        if (text !== previous) {
          previous = text
          stableSince = Date.now()
        }
        const [loaded, requested] = [match[1], match[2]]
        return (
          requested !== '0' &&
          loaded === requested &&
          Date.now() - stableSince > 1500
        )
      },
      { timeout: 60_000, intervals: [500] },
    )
    .toBe(true)
}

/** Opens a viewer URL and waits for the first slide to finish rendering */
export async function openViewer(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await expect(slidePanel(page)).toBeVisible({ timeout: 60_000 })
  await waitForTilesSettled(page)
}

/** The DMV main viewport is the largest OpenLayers viewport on the page */
async function mainViewportClip(page: Page) {
  const box = await page.evaluate(() => {
    const viewports = Array.from(document.querySelectorAll('.ol-viewport'))
    const rects = viewports.map((element) => element.getBoundingClientRect())
    const largest = rects.sort(
      (a, b) => b.width * b.height - a.width * a.height,
    )[0]
    return largest === undefined
      ? null
      : {
          x: largest.x,
          y: largest.y,
          width: largest.width,
          height: largest.height,
        }
  })
  expect(box, 'main viewport').not.toBeNull()
  return box as { x: number; y: number; width: number; height: number }
}

export async function mainViewportCenter(
  page: Page,
): Promise<{ x: number; y: number }> {
  const clip = await mainViewportClip(page)
  return { x: clip.x + clip.width / 2, y: clip.y + clip.height / 2 }
}

/** PNG of the main viewport only; whole-page shots change with panel scroll */
export async function captureViewport(page: Page): Promise<Buffer> {
  return page.screenshot({ clip: await mainViewportClip(page) })
}

/** Decodes PNGs in the page, so the suite needs no image dependency */
async function decodeAndMeasure(
  page: Page,
  pngs: Buffer[],
): Promise<{ stats: ViewportStats[]; meanDiff: number }> {
  return page.evaluate(
    async (encoded) => {
      const images = await Promise.all(
        encoded.map(async (base64) => {
          const blob = await (
            await fetch(`data:image/png;base64,${base64}`)
          ).blob()
          const bitmap = await createImageBitmap(blob)
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
          const context = canvas.getContext('2d')
          if (context === null) throw new Error('No 2D context')
          context.drawImage(bitmap, 0, 0)
          return context.getImageData(0, 0, bitmap.width, bitmap.height).data
        }),
      )
      const luminance = (data: Uint8ClampedArray, i: number): number =>
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      const stats = images.map((data) => {
        let sum = 0
        let sumSquares = 0
        const count = data.length / 4
        for (let i = 0; i < data.length; i += 4) {
          const value = luminance(data, i)
          sum += value
          sumSquares += value * value
        }
        const mean = sum / count
        return { mean, stdDev: Math.sqrt(sumSquares / count - mean * mean) }
      })
      let meanDiff = 0
      if (images.length === 2 && images[0].length === images[1].length) {
        let total = 0
        for (let i = 0; i < images[0].length; i += 4) {
          total += Math.abs(luminance(images[0], i) - luminance(images[1], i))
        }
        meanDiff = total / (images[0].length / 4)
      }
      return { stats, meanDiff }
    },
    pngs.map((png) => png.toString('base64')),
  )
}

export async function viewportStats(
  page: Page,
  png: Buffer,
): Promise<ViewportStats> {
  return (await decodeAndMeasure(page, [png])).stats[0]
}

/** Mean absolute luminance difference between two viewport captures */
export async function viewportDiff(
  page: Page,
  before: Buffer,
  after: Buffer,
): Promise<number> {
  return (await decodeAndMeasure(page, [before, after])).meanDiff
}

/**
 * WebGL paints after the last tile arrives and layer changes repaint over a
 * few frames, so pixel checks wait until captures stop changing. Layers that
 * draw in bursts need a longer quiet period than two captures in a row.
 */
export async function captureSettledViewport(
  page: Page,
  { quietMs = 0, timeout = 30_000 } = {},
): Promise<Buffer> {
  await waitForTilesSettled(page)
  let previous = await captureViewport(page)
  let lastChange = Date.now()
  await expect
    .poll(
      async () => {
        const next = await captureViewport(page)
        const isUnchanged = (await viewportDiff(page, previous, next)) < 0.01
        previous = next
        if (!isUnchanged) lastChange = Date.now()
        return isUnchanged && Date.now() - lastChange >= quietMs
      },
      { message: 'viewport stops changing', timeout, intervals: [250] },
    )
    .toBe(true)
  return previous
}

/** Waits for the viewport to move away from a reference capture */
export async function expectViewportToDiffer(
  page: Page,
  reference: Buffer,
  minDiff: number,
): Promise<void> {
  await expect
    .poll(
      async () => viewportDiff(page, reference, await captureViewport(page)),
      { message: 'viewport differs from reference', timeout: 30_000 },
    )
    .toBeGreaterThan(minDiff)
}

/** Waits for the viewport to come back to a reference capture */
export async function expectViewportToMatch(
  page: Page,
  reference: Buffer,
  maxDiff: number,
): Promise<void> {
  await expect
    .poll(
      async () => viewportDiff(page, reference, await captureViewport(page)),
      { message: 'viewport matches reference', timeout: 30_000 },
    )
    .toBeLessThan(maxDiff)
}

/**
 * Asserts tissue is painted: a blank canvas has a luminance spread near 0,
 * brightfield H&E about 39 and sparse fluorescence on black about 9.
 */
export async function expectTissueRendered(
  page: Page,
  minSpread = 10,
): Promise<void> {
  await expect
    .poll(
      async () =>
        (await viewportStats(page, await captureViewport(page))).stdDev,
      { message: 'viewport luminance spread', timeout: 30_000 },
    )
    .toBeGreaterThan(minSpread)
}

/** Alt shortcuts fire on keyup and need focus on the page, not a field */
export async function pressViewerShortcut(
  page: Page,
  key: string,
): Promise<void> {
  const center = await mainViewportCenter(page)
  await page.mouse.move(center.x, center.y)
  await page.keyboard.down('Alt')
  await page.keyboard.press(key)
  await page.keyboard.up('Alt')
}
