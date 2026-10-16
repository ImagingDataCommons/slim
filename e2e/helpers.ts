import { type Page, expect } from '@playwright/test'

/**
 * Default target: the TCGA-02-0001 glioblastoma study on the public IDC proxy.
 * Slim auto-selects slide DX1, whose referenced SM series is overlaid by a
 * single POLYGON "Nuclei" annotation group of ~396k annotations — a good
 * stress test for the deck.gl LOD / spatial-tiling path.
 */
export const STUDY_UID =
  process.env.E2E_STUDY_UID ?? '2.25.68803095896966276583382138924964839274'

/**
 * SM series for slide DX1. Pinning this (instead of relying on slim's default
 * study→series redirect) keeps the visual baseline pointed at one slide —
 * this study has four, each with its own ~hundreds-of-thousands Nuclei group.
 */
export const SERIES_UID =
  process.env.E2E_SERIES_UID ??
  '1.3.6.1.4.1.5962.99.1.1163866303.1057408148.1637546438847.2.0'

/** Name of the annotation group to exercise. */
export const GROUP_NAME = process.env.E2E_GROUP_NAME ?? 'Nuclei'

/** Non-transparent deck-canvas pixels that count as "annotations drawn". */
const DRAWN_PIXEL_THRESHOLD = 500

/** Ignore network-idle timeouts; WSI tile streaming rarely goes truly idle. */
function ignoreNetworkIdleTimeout(): undefined {
  return undefined
}

/**
 * Read the deck.gl overlay canvas (the large WebGL2 canvas inside the OL map)
 * and count non-transparent pixels. Returns -1 when the canvas is not found.
 *
 * A fresh getContext() returns the existing context, so this reflects the live
 * overlay rather than a new blank buffer.
 */
export async function deckDrawnPixelCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'))
    const deck = canvases.find((canvas) => {
      try {
        return canvas.getContext('webgl2') != null && canvas.width > 200
      } catch {
        return false
      }
    })
    if (deck == null) {
      return -1
    }
    const gl = deck.getContext('webgl2')
    if (gl == null) {
      return -1
    }
    const { width, height } = deck
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let nonTransparent = 0
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] !== 0) {
        nonTransparent++
      }
    }
    return nonTransparent
  })
}

/** Current JS heap usage in MB (Chromium only), or -1 when unavailable. */
export async function usedHeapMB(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const mem = (
      performance as unknown as { memory?: { usedJSHeapSize: number } }
    ).memory
    return mem != null
      ? Number((mem.usedJSHeapSize / 1048576).toFixed(1))
      : -1
  })
}

/** Bounding box of the largest OpenLayers viewport (the main volume viewer). */
export async function mapClip(page: Page): Promise<{
  x: number
  y: number
  width: number
  height: number
}> {
  const box = await page.evaluate(() => {
    const viewports = Array.from(document.querySelectorAll('.ol-viewport'))
    let best: DOMRect | null = null
    for (const viewport of viewports) {
      const rect = viewport.getBoundingClientRect()
      if (best == null || rect.width * rect.height > best.width * best.height) {
        best = rect
      }
    }
    return best == null
      ? null
      : { x: best.x, y: best.y, width: best.width, height: best.height }
  })
  if (box == null) {
    throw new Error('Could not locate the OpenLayers map viewport')
  }
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  }
}

/**
 * Wait until the main slide viewer has mounted and image tiles have settled.
 * A whole-slide image streams tiles continuously, so we bound the network-idle
 * wait and always add a fixed settle rather than relying on true idle.
 */
export async function waitForSlide(page: Page): Promise<void> {
  await page.waitForSelector('.ol-viewport canvas', { timeout: 180_000 })
  // The left metadata panel (which holds the Annotation Groups accordion)
  // renders once the slide's instances have been fetched.
  await page
    .getByRole('menuitem', { name: 'Annotation Groups' })
    .waitFor({ timeout: 180_000 })
  await page
    .waitForLoadState('networkidle', { timeout: 30_000 })
    .catch(ignoreNetworkIdleTimeout)
  await page.waitForTimeout(2000)
}

/** Expand the "Annotation Groups" accordion so its switches render. */
export async function expandAnnotationGroups(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Annotation Groups' }).click()
  await page.getByRole('switch').first().waitFor({ timeout: 15_000 })
  await page.waitForTimeout(500)
}

/**
 * Report whether the named group's visibility switch is checked, or null when
 * the switch cannot be found. The switch lives in the same list container as
 * the group's menuitem, so the in-page lookup walks up from the menuitem until
 * it finds one. (The lookup is duplicated in setGroupVisibility because
 * functions cannot be shared across the browser boundary.)
 */
async function groupSwitchChecked(
  page: Page,
  groupName: string,
): Promise<boolean | null> {
  return await page.evaluate((name) => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
    const item = items.find((el) => (el.textContent ?? '').includes(name))
    let container: Element | null | undefined = item
    for (let depth = 0; depth < 6 && container != null; depth++) {
      const sw = container.querySelector('button[role="switch"]')
      if (sw != null) {
        return sw.getAttribute('aria-checked') === 'true'
      }
      container = container.parentElement
    }
    return null
  }, groupName)
}

/**
 * Set the visibility of the annotation group with the given name and wait for
 * the switch state to reflect it (aria-checked updates asynchronously after
 * React re-renders).
 *
 * The switch can sit beneath the sticky footer, so it is toggled through the
 * DOM (a real user would scroll first; the click still exercises the app's
 * handler).
 */
export async function setGroupVisibility(
  page: Page,
  groupName: string,
  visible: boolean,
): Promise<void> {
  const result = await page.evaluate(
    ({ groupName: name, visible: wantVisible }) => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
      const item = items.find((el) => (el.textContent ?? '').includes(name))
      let sw: HTMLButtonElement | null = null
      let container: Element | null | undefined = item
      for (let depth = 0; depth < 6 && container != null; depth++) {
        sw = container.querySelector('button[role="switch"]')
        if (sw != null) {
          break
        }
        container = container.parentElement
      }
      if (sw == null) {
        return 'switch-not-found'
      }
      const checked = sw.getAttribute('aria-checked') === 'true'
      if (checked !== wantVisible) {
        sw.click()
      }
      return 'ok'
    },
    { groupName, visible },
  )
  if (result !== 'ok') {
    throw new Error(
      `Visibility switch for annotation group "${groupName}" not found`,
    )
  }
  await expect
    .poll(async () => await groupSwitchChecked(page, groupName), {
      timeout: 15_000,
    })
    .toBe(visible)
}

/** Poll until the deck overlay has drawn content (annotations visible). */
export async function waitForAnnotationsDrawn(page: Page): Promise<number> {
  let count = 0
  await expect
    .poll(
      async () => {
        count = await deckDrawnPixelCount(page)
        return count
      },
      { timeout: 180_000, intervals: [1000, 2000, 3000, 5000] },
    )
    .toBeGreaterThan(DRAWN_PIXEL_THRESHOLD)
  return count
}

/**
 * Wait until annotation loading has settled by polling the drawn-pixel count
 * until it stops changing across consecutive samples.
 *
 * This matters for deterministic screenshots: a group streams in progressively
 * and the whole-slide overlay only reflects the complete group once streaming
 * finishes. Waiting for a stable count first makes the screenshot identical
 * every run.
 */
export async function waitForAnnotationsStable(page: Page): Promise<void> {
  let previous = -1
  let stableSamples = 0
  const requiredStableSamples = 3
  await expect
    .poll(
      async () => {
        const count = await deckDrawnPixelCount(page)
        // Tolerate tiny sampling jitter (< 0.5%) as "unchanged".
        const changed =
          previous < 0 || Math.abs(count - previous) > previous * 0.005 + 50
        stableSamples = changed ? 0 : stableSamples + 1
        previous = count
        return stableSamples
      },
      { timeout: 180_000, intervals: [2000] },
    )
    .toBeGreaterThanOrEqual(requiredStableSamples)
}

/** Poll until the deck overlay is effectively empty (annotations hidden). */
export async function waitForAnnotationsCleared(page: Page): Promise<void> {
  await expect
    .poll(async () => await deckDrawnPixelCount(page), {
      timeout: 60_000,
      intervals: [500, 1000, 2000],
    })
    .toBeLessThan(DRAWN_PIXEL_THRESHOLD)
}

/**
 * Hide everything that is not the deck.gl annotation overlay so screenshots
 * compare only the annotation rendering (and not flaky WSI tile decoding,
 * the overview map, or the scale bar).
 *
 * Mutates the live page; call immediately before toHaveScreenshot.
 */
export async function prepareAnnotationScreenshot(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const canvas of document.querySelectorAll('canvas')) {
      try {
        if (canvas.getContext('webgl2') == null) {
          ;(canvas as HTMLElement).style.visibility = 'hidden'
        }
      } catch {
        ;(canvas as HTMLElement).style.visibility = 'hidden'
      }
    }
    for (const selector of [
      '.ol-overviewmap',
      '.ol-scale-line',
      '.ol-zoom',
      '.ol-attribution',
    ]) {
      document.querySelectorAll(selector).forEach((el) => {
        ;(el as HTMLElement).style.visibility = 'hidden'
      })
    }
    // Slim's custom scale / overview chrome is not always an OL control.
    document.querySelectorAll('body *').forEach((el) => {
      const text = (el.textContent ?? '').trim()
      if (/^\d+(\.\d+)?\s*(µm|mm|cm)$/.test(text)) {
        ;(el as HTMLElement).style.visibility = 'hidden'
        const parent = el.parentElement
        if (parent != null) {
          parent.style.visibility = 'hidden'
        }
      }
    })
  })
}
