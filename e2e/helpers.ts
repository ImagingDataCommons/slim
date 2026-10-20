import { expect, type Locator, type Page } from '@playwright/test'

export interface ViewportStats {
  mean: number
  stdDev: number
}

export const IDC_PROXY =
  'https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb'

/** Merges `overrides` into public/config/e2e.js for every page load of `page` */
export async function overrideConfig(
  page: Page,
  overrides: Record<string, unknown>,
): Promise<void> {
  await page.route('**/config/e2e.js', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      body: `${await response.text()}\nObject.assign(window.config, ${JSON.stringify(overrides)})\n`,
    })
  })
}

/** Answers requests below `fakeBase` from the IDC proxy, so any server URL can serve real data */
export async function serveFromIdc(
  page: Page,
  fakeBase: string,
): Promise<void> {
  await page.route(`${fakeBase}/**`, async (route) => {
    const response = await route.fetch({
      url: route.request().url().replace(fakeBase, IDC_PROXY),
    })
    await route.fulfill({ response })
  })
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
export async function waitForTilesSettled(
  page: Page,
  timeout = 60_000,
): Promise<void> {
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
      { timeout, intervals: [500] },
    )
    .toBe(true)
}

/** Opens a viewer URL and waits for the first slide to finish rendering */
export async function openViewer(
  page: Page,
  url: string,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 60_000
  await page.goto(url)
  await expect(slidePanel(page)).toBeVisible({ timeout })
  await waitForTilesSettled(page, timeout)
}

/** The DMV main viewport is the largest OpenLayers viewport on the page */
export async function mainViewportClip(page: Page) {
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

/**
 * Settled main-viewport screenshot compared to a committed baseline.
 * Baselines live next to the spec (`*-snapshots/`) and are platform-specific
 * (Playwright appends the browser and OS). Update with
 * `pnpm test:e2e:visual:update` on the same OS as CI (Linux).
 */
export async function expectSettledViewportScreenshot(
  page: Page,
  name: string,
): Promise<void> {
  await captureSettledViewport(page)
  await expect(page).toHaveScreenshot(`${name}.png`, {
    clip: await mainViewportClip(page),
    animations: 'disabled',
  })
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

export async function chooseOption(
  page: Page,
  trigger: Locator,
  option: string,
): Promise<void> {
  await trigger.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** Expands Display options inside an Optical paths / overlays section */
export async function openDisplayOptions(container: Locator): Promise<Locator> {
  const toggle = container.getByRole('button', { name: /^Display options/ })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  return container
}

/**
 * Sets the Optical paths → Gamma correction switch. Gamma only affects
 * palette-mapped layers (fluorescence PRs, SEG, PM), not RGB/ICC tiles.
 */
export async function setGammaCorrection(
  page: Page,
  enabled: boolean,
): Promise<void> {
  const paths = await openDisplayOptions(
    await section(slidePanel(page), 'Optical paths'),
  )
  const gamma = paths.getByRole('switch', { name: 'Gamma correction' })
  await expect(gamma).toBeVisible()
  const isChecked = await gamma.isChecked()
  if (isChecked !== enabled) {
    await gamma.click()
  }
  if (enabled) {
    await expect(gamma).toBeChecked()
  } else {
    await expect(gamma).not.toBeChecked()
  }
}

/** Configures the Draw dialog: finding, optional grade, then geometry */
export async function configureDraw(
  page: Page,
  finding: string,
  geometry: string,
  grade?: string,
): Promise<void> {
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Configure annotation')).toBeVisible()
  const selects = dialog.getByRole('combobox')
  await chooseOption(page, selects.first(), finding)
  if (grade !== undefined) await chooseOption(page, selects.nth(1), grade)
  await chooseOption(page, selects.last(), geometry)
  await dialog.getByRole('button', { name: 'Start drawing' }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Draw', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
}

/**
 * Clicks the corners of a 240 × 160 px rectangle, `offsetX` px from the
 * viewport center, and closes it on the first point. Returns the rectangle.
 */
export async function drawPolygon(
  page: Page,
  offsetX = 0,
): Promise<{ left: number; right: number; top: number; bottom: number }> {
  const center = await mainViewportCenter(page)
  const x = center.x + offsetX
  const rectangle = {
    left: x - 120,
    right: x + 120,
    top: center.y - 80,
    bottom: center.y + 80,
  }
  const corners = [
    [rectangle.left, rectangle.top],
    [rectangle.right, rectangle.top],
    [rectangle.right, rectangle.bottom],
    [rectangle.left, rectangle.bottom],
    [rectangle.left, rectangle.top],
  ]
  for (const [cornerX, cornerY] of corners) {
    await page.mouse.click(cornerX, cornerY)
  }
  return rectangle
}

/** Labels as shown in the Draw dialog (e2e config Tumor finding). */
export const GEOMETRY_LABELS = [
  'Point',
  'Circle',
  'Box',
  'Polygon',
  'Line',
  'Polygon (freehand)',
  'Line (freehand)',
] as const

export type GeometryLabel = (typeof GEOMETRY_LABELS)[number]

/**
 * Draws one ROI of `geometry` near the viewport center, shifted by `offsetX`.
 * Call after configureDraw / Start drawing.
 */
export async function drawGeometry(
  page: Page,
  geometry: GeometryLabel,
  offsetX = 0,
): Promise<void> {
  const center = await mainViewportCenter(page)
  const x = center.x + offsetX
  const y = center.y
  switch (geometry) {
    case 'Point':
      await page.mouse.click(x, y)
      break
    case 'Line':
      await page.mouse.click(x - 80, y - 40)
      await page.waitForTimeout(200)
      /** Finish the line: OpenLayers ends a LineString on double-click. */
      await page.mouse.dblclick(x + 80, y + 40)
      break
    case 'Box':
      /** OL box: first click anchors a corner, move, second click finishes. */
      await page.mouse.click(x - 70, y - 50)
      await page.mouse.move(x + 70, y + 50, { steps: 10 })
      await page.mouse.click(x + 70, y + 50)
      break
    case 'Circle':
      await page.mouse.click(x, y)
      await page.waitForTimeout(200)
      await page.mouse.click(x + 60, y)
      break
    case 'Polygon':
      await drawPolygon(page, offsetX)
      break
    case 'Line (freehand)':
      await page.mouse.move(x - 90, y)
      await page.mouse.down()
      for (const [dx, dy] of [
        [-30, -40],
        [40, 20],
        [90, 0],
      ] as const) {
        await page.mouse.move(x + dx, y + dy, { steps: 5 })
      }
      await page.mouse.up()
      break
    case 'Polygon (freehand)':
      await page.mouse.move(x - 60, y - 50)
      await page.mouse.down()
      for (const [dx, dy] of [
        [60, -50],
        [60, 50],
        [-60, 50],
        [-60, -50],
      ] as const) {
        await page.mouse.move(x + dx, y + dy, { steps: 5 })
      }
      await page.mouse.up()
      break
    default: {
      const unexpected: never = geometry
      throw new Error(`Unsupported geometry: ${unexpected}`)
    }
  }
}

/** Go to marks the slide center with a point ROI drawn in the default style */
export async function goToSlideCenter(page: Page): Promise<void> {
  await pressViewerShortcut(page, 'KeyG')
  const dialog = page.getByRole('dialog')
  const center = async (label: string): Promise<string> => {
    const [min, max] = (
      (await dialog.getByLabel(label).getAttribute('placeholder')) ?? '0 – 0'
    )
      .split(' – ')
      .map(Number)
    return ((min + max) / 2).toFixed(2)
  }
  await dialog
    .getByLabel('X coordinate (mm)')
    .fill(await center('X coordinate (mm)'))
  await dialog
    .getByLabel('Y coordinate (mm)')
    .fill(await center('Y coordinate (mm)'))
  await dialog.getByLabel('Magnification').fill('2')
  await dialog.getByRole('button', { name: 'Go to position' }).click()
  await expect(dialog).toBeHidden()
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
