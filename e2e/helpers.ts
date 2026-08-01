import { type Page, expect } from '@playwright/test'

/**
 * Default target: the TCGA-02-0001 glioblastoma study on the public IDC proxy.
 * Slim auto-selects slide DX1, whose referenced SM series is overlaid by a
 * single POLYGON "Nuclei" annotation group of ~396k annotations — a good
 * stress test for the deck.gl LOD / spatial-tiling path.
 */
export const STUDY_UID =
  process.env.E2E_STUDY_UID ?? '2.25.68803095896966276583382138924964839274'

/** Name of the annotation group to exercise. */
export const GROUP_NAME = process.env.E2E_GROUP_NAME ?? 'Nuclei'

/** Non-transparent deck-canvas pixels that count as "annotations drawn". */
const DRAWN_PIXEL_THRESHOLD = 500

/**
 * Read the deck.gl overlay canvas (the large WebGL2 canvas inside the OL map)
 * and count non-transparent pixels. Returns -1 when the canvas is not found.
 *
 * A fresh getContext() returns the existing context, so this reflects the live
 * overlay rather than a new blank buffer.
 */
export async function deckDrawnPixelCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'))
    const deck = canvases.find((c) => {
      try {
        return c.getContext('webgl2') != null && c.width > 200
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
    const px = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px)
    let nonTransparent = 0
    for (let i = 3; i < px.length; i += 4) {
      if (px[i] !== 0) {
        nonTransparent++
      }
    }
    return nonTransparent
  })
}

/** Current JS heap usage in MB (Chromium only), or -1 when unavailable. */
export async function usedHeapMB(page: Page): Promise<number> {
  return page.evaluate(() => {
    const mem = (
      performance as unknown as { memory?: { usedJSHeapSize: number } }
    ).memory
    return mem != null ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : -1
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
    for (const vp of viewports) {
      const r = vp.getBoundingClientRect()
      if (best == null || r.width * r.height > best.width * best.height) {
        best = r
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
    .catch(() => {})
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
  return page.evaluate((groupName) => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
    const item = items.find((el) => (el.textContent ?? '').includes(groupName))
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
    ({ groupName, visible }) => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'))
      const item = items.find((el) =>
        (el.textContent ?? '').includes(groupName),
      )
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
      if (checked !== visible) {
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
    .poll(async () => groupSwitchChecked(page, groupName), {
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
 * and "zoom to group" fits the *currently loaded* extent, so zooming before
 * streaming completes yields a different (more zoomed) view each run. Waiting
 * for a stable count first makes the fitted extent identical every time.
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
    .poll(async () => deckDrawnPixelCount(page), {
      timeout: 60_000,
      intervals: [500, 1000, 2000],
    })
    .toBeLessThan(DRAWN_PIXEL_THRESHOLD)
}
