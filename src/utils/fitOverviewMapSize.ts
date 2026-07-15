/**
 * Shared overview mini-map sizing (kept in sync with DMV's
 * `_updateOverviewMapSize` intent). Slim applies this client-side because the
 * published `dicom-microscopy-viewer` bundle may not yet include the same fix;
 * local DMV `viewer.js` edits are out of band until that package is bumped.
 */

/** Matching inset from the left and bottom edges of the map viewport (px). */
export const OVERVIEW_EDGE_INSET_PX = 8

/** Extra top clearance so a tall mini-map does not cover the toolbar. */
export const OVERVIEW_TOP_HEADROOM_PX = 12

/**
 * Floor for mini-map height so wide/thin slides stay usable (width-first
 * sizing otherwise collapses height with the slide aspect ratio).
 */
export const MIN_OVERVIEW_HEIGHT_PX = 80

/**
 * Prefer this fraction of the viewport width before spilling to nearly-full
 * width to satisfy {@link MIN_OVERVIEW_HEIGHT_PX}.
 */
export const PREFERRED_OVERVIEW_WIDTH_FRACTION = 0.45

export type OverviewMapSizeBounds = {
  maxMapWidth: number
  maxMapHeight: number
  preferredMaxWidth: number
  minMapHeight: number
}

export type OverviewMapSize = {
  width: number
  height: number
}

export function overviewMapSizeBounds(
  containerWidth: number,
  containerHeight: number,
  chromeX = 0,
  chromeY = 0,
): OverviewMapSizeBounds {
  const maxMapHeight = Math.max(
    0,
    containerHeight -
      OVERVIEW_EDGE_INSET_PX -
      OVERVIEW_TOP_HEADROOM_PX -
      chromeY,
  )
  const maxMapWidth = Math.max(
    0,
    containerWidth - 2 * OVERVIEW_EDGE_INSET_PX - chromeX,
  )
  const preferredMaxWidth = Math.min(
    maxMapWidth,
    containerWidth * PREFERRED_OVERVIEW_WIDTH_FRACTION,
  )
  const minMapHeight = Math.min(MIN_OVERVIEW_HEIGHT_PX, maxMapHeight)
  return { maxMapWidth, maxMapHeight, preferredMaxWidth, minMapHeight }
}

/**
 * Fit overview map size into the viewport: grow short (wide) maps, shrink tall
 * ones, keep aspect ratio.
 */
export function fitOverviewMapSize(
  width: number,
  height: number,
  bounds: OverviewMapSizeBounds,
): OverviewMapSize {
  if (!(width > 0) || !(height > 0)) {
    return { width, height }
  }

  const aspect = width / height
  let nextWidth = width
  let nextHeight = height
  const { maxMapWidth, maxMapHeight, preferredMaxWidth, minMapHeight } = bounds

  /** Wide/thin slides: raise height to the floor and let width grow. */
  if (nextHeight < minMapHeight - 0.5) {
    nextHeight = minMapHeight
    nextWidth = nextHeight * aspect
  }

  /** Prefer staying within preferred width; if still too short, use full width. */
  if (nextWidth > preferredMaxWidth + 0.5) {
    nextWidth = preferredMaxWidth
    nextHeight = nextWidth / aspect
    if (nextHeight < minMapHeight - 0.5 && maxMapWidth > preferredMaxWidth) {
      nextWidth = maxMapWidth
      nextHeight = nextWidth / aspect
    }
  }

  if (nextHeight > maxMapHeight + 0.5) {
    nextHeight = maxMapHeight
    nextWidth = nextHeight * aspect
  }

  if (nextWidth > maxMapWidth + 0.5) {
    nextWidth = maxMapWidth
    nextHeight = nextWidth / aspect
  }

  return { width: nextWidth, height: nextHeight }
}
