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
 * Floor for each mini-map side so thin slides stay usable after preferred-box
 * sizing. Growth to meet this still respects {@link MAX_OVERVIEW_FRACTION}.
 */
export const MIN_OVERVIEW_SIDE_PX = 80

/** @deprecated Use {@link MIN_OVERVIEW_SIDE_PX}. */
export const MIN_OVERVIEW_HEIGHT_PX = MIN_OVERVIEW_SIDE_PX

/**
 * Prefer fitting inside this fraction of the viewport (both axes) before
 * growing toward the max box to meet {@link MIN_OVERVIEW_SIDE_PX}.
 */
export const PREFERRED_OVERVIEW_FRACTION = 0.45

/** @deprecated Use {@link PREFERRED_OVERVIEW_FRACTION}. */
export const PREFERRED_OVERVIEW_WIDTH_FRACTION = PREFERRED_OVERVIEW_FRACTION

/**
 * Hard cap so the mini-map cannot approach the size of the main image (wide
 * slides used to spill to nearly full viewport width).
 */
export const MAX_OVERVIEW_FRACTION = 0.6

export type OverviewMapSizeBounds = {
  maxMapWidth: number
  maxMapHeight: number
  preferredMaxWidth: number
  preferredMaxHeight: number
  minMapWidth: number
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
  const insetMaxWidth = Math.max(
    0,
    containerWidth - 2 * OVERVIEW_EDGE_INSET_PX - chromeX,
  )
  const insetMaxHeight = Math.max(
    0,
    containerHeight -
      OVERVIEW_EDGE_INSET_PX -
      OVERVIEW_TOP_HEADROOM_PX -
      chromeY,
  )
  const maxMapWidth = Math.min(
    insetMaxWidth,
    containerWidth * MAX_OVERVIEW_FRACTION,
  )
  const maxMapHeight = Math.min(
    insetMaxHeight,
    containerHeight * MAX_OVERVIEW_FRACTION,
  )
  const preferredMaxWidth = Math.min(
    maxMapWidth,
    containerWidth * PREFERRED_OVERVIEW_FRACTION,
  )
  const preferredMaxHeight = Math.min(
    maxMapHeight,
    containerHeight * PREFERRED_OVERVIEW_FRACTION,
  )
  const minMapWidth = Math.min(MIN_OVERVIEW_SIDE_PX, maxMapWidth)
  const minMapHeight = Math.min(MIN_OVERVIEW_SIDE_PX, maxMapHeight)
  return {
    maxMapWidth,
    maxMapHeight,
    preferredMaxWidth,
    preferredMaxHeight,
    minMapWidth,
    minMapHeight,
  }
}

/**
 * Fit overview map size into the viewport symmetrically for wide and tall
 * slides: contain in the preferred box, grow toward the max box only to meet
 * minimum side length, then contain in the max box. Aspect ratio is preserved.
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
  const {
    maxMapWidth,
    maxMapHeight,
    preferredMaxWidth,
    preferredMaxHeight,
    minMapWidth,
    minMapHeight,
  } = bounds

  if (
    !(preferredMaxWidth > 0) ||
    !(preferredMaxHeight > 0) ||
    !(maxMapWidth > 0) ||
    !(maxMapHeight > 0)
  ) {
    return { width: 0, height: 0 }
  }

  /** Contain in preferred box. */
  let nextHeight = Math.min(preferredMaxHeight, preferredMaxWidth / aspect)
  let nextWidth = nextHeight * aspect

  /** Grow toward max box to meet minimum side lengths. */
  const scaleUp = Math.max(
    1,
    minMapHeight > 0 ? minMapHeight / nextHeight : 1,
    minMapWidth > 0 ? minMapWidth / nextWidth : 1,
  )
  nextWidth *= scaleUp
  nextHeight *= scaleUp

  /** Contain in max box (never dominate the main viewport). */
  const scaleDown = Math.min(
    1,
    maxMapWidth / nextWidth,
    maxMapHeight / nextHeight,
  )
  nextWidth *= scaleDown
  nextHeight *= scaleDown

  return { width: nextWidth, height: nextHeight }
}
