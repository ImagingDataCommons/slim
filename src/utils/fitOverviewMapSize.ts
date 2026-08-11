/**
 * Shared overview mini-map sizing (kept in sync with DMV's
 * `_updateOverviewMapSize` in dicom-microscopy-viewer/src/viewer.js).
 * Slim applies this client-side because the published
 * `dicom-microscopy-viewer` bundle may not yet include the same fix;
 * local DMV `viewer.js` edits are out of band until that package is bumped.
 *
 * Keep these constants aligned with DMV when changing either side:
 * edgeInsetPx=8, topHeadroomPx=12, minOverviewSidePx=48,
 * preferredBoxPx=150, maxBoxPx=200, preferredFraction=0.25, maxFraction=0.3.
 *
 * OpenLayers' native OverviewMap does **not** size by viewport fraction: its
 * default CSS is a fixed 150×150px box (`.ol-overviewmap-map` in `ol.css`), and
 * the official custom example uses ~300px width. We follow that model: contain
 * the slide aspect ratio in a fixed pixel box, with a hard absolute cap so
 * extreme aspects / large monitors cannot dominate the viewport.
 */

/** Matching inset from the left and bottom edges of the map viewport (px). */
export const OVERVIEW_EDGE_INSET_PX = 8

/** Extra top clearance so a tall mini-map does not cover the toolbar. */
export const OVERVIEW_TOP_HEADROOM_PX = 12

/**
 * Floor for each mini-map side so ultra-thin slides stay clickable. Growth to
 * meet this still respects {@link MAX_OVERVIEW_BOX_PX}.
 */
export const MIN_OVERVIEW_SIDE_PX = 48

/** @deprecated Use {@link MIN_OVERVIEW_SIDE_PX}. */
export const MIN_OVERVIEW_HEIGHT_PX = MIN_OVERVIEW_SIDE_PX

/**
 * Preferred contain box — OpenLayers default `.ol-overviewmap-map` size.
 * Tall and wide slides share this budget so the footprint stays consistent.
 */
export const PREFERRED_OVERVIEW_BOX_PX = 150

/**
 * Hard absolute contain box (px). Slightly above the OL default so min-side
 * growth on extreme aspects has a little room without approaching the OL
 * custom-example 300px size.
 */
export const MAX_OVERVIEW_BOX_PX = 200

/**
 * @deprecated Viewport fractions are no longer the primary budget; kept so
 * older imports keep resolving. Prefer {@link PREFERRED_OVERVIEW_BOX_PX}.
 */
export const PREFERRED_OVERVIEW_FRACTION = 0.25

/** @deprecated Use {@link PREFERRED_OVERVIEW_FRACTION}. */
export const PREFERRED_OVERVIEW_WIDTH_FRACTION = PREFERRED_OVERVIEW_FRACTION

/**
 * @deprecated Viewport fractions are no longer the primary budget; kept so
 * older imports keep resolving. Prefer {@link MAX_OVERVIEW_BOX_PX}.
 */
export const MAX_OVERVIEW_FRACTION = 0.3

/** @deprecated Use {@link PREFERRED_OVERVIEW_BOX_PX}. */
export const PREFERRED_OVERVIEW_LONG_SIDE_PX = PREFERRED_OVERVIEW_BOX_PX

/** @deprecated Use {@link MAX_OVERVIEW_BOX_PX}. */
export const MAX_OVERVIEW_LONG_SIDE_PX = MAX_OVERVIEW_BOX_PX

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
  /**
   * Primary budget is the fixed OL-style box; fractions only shrink further on
   * tiny viewports so the mini-map cannot overflow the slide area.
   */
  const maxMapWidth = Math.min(
    insetMaxWidth,
    containerWidth * MAX_OVERVIEW_FRACTION,
    MAX_OVERVIEW_BOX_PX,
  )
  const maxMapHeight = Math.min(
    insetMaxHeight,
    containerHeight * MAX_OVERVIEW_FRACTION,
    MAX_OVERVIEW_BOX_PX,
  )
  const preferredMaxWidth = Math.min(
    maxMapWidth,
    containerWidth * PREFERRED_OVERVIEW_FRACTION,
    PREFERRED_OVERVIEW_BOX_PX,
  )
  const preferredMaxHeight = Math.min(
    maxMapHeight,
    containerHeight * PREFERRED_OVERVIEW_FRACTION,
    PREFERRED_OVERVIEW_BOX_PX,
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
 * Fit overview map size into a fixed OL-style box: contain in the preferred
 * box, grow toward the max box only to meet minimum side length, then contain
 * in the max box. Aspect ratio is preserved.
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
