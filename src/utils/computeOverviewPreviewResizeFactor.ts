/** Default slide-list preview height (see {@link SlideItem}). */
export const SLIDE_PREVIEW_HEIGHT_PX = 100

/** Fallback width when the container has not been laid out yet. */
export const SLIDE_PREVIEW_FALLBACK_WIDTH_PX = 280

export type OverviewPreviewMatrixSize = {
  TotalPixelMatrixColumns: number
  TotalPixelMatrixRows: number
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a))
  let y = Math.abs(Math.trunc(b))
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x === 0 ? 1 : x
}

/**
 * Scale factor for {@link OverviewImageViewer}'s `resizeFactor` so the DICOMweb
 * rendered preview extent matches the slide-list tile and the server returns a
 * reasonably sized PNG (via the viewport query param when factor &lt; 1).
 *
 * Without this, THUMBNAIL / large OVERVIEW instances keep the full-slide
 * TotalPixelMatrix extent while the rendered image is much smaller — the preview
 * shows a tiny image in a huge canvas or fails to fit (#399).
 *
 * Google Healthcare DICOMweb rejects non-integer `viewport` values (HTTP 400).
 * DMV builds `viewport` as `cols*factor,rows*factor`, so the factor must yield
 * integer pixel sizes on both axes. When no such downscale fits the tile, return
 * `1` (omit viewport; OL fits the full rendered instance).
 */
export function computeOverviewPreviewResizeFactor(
  metadata: OverviewPreviewMatrixSize,
  containerWidth: number,
  containerHeight: number,
): number {
  const cols = Number(metadata.TotalPixelMatrixColumns)
  const rows = Number(metadata.TotalPixelMatrixRows)
  if (
    !Number.isFinite(cols) ||
    !Number.isFinite(rows) ||
    cols <= 0 ||
    rows <= 0
  ) {
    return 1
  }

  const width = Math.floor(
    containerWidth > 0 ? containerWidth : SLIDE_PREVIEW_FALLBACK_WIDTH_PX,
  )
  const height = Math.floor(
    containerHeight > 0 ? containerHeight : SLIDE_PREVIEW_HEIGHT_PX,
  )
  if (width <= 0 || height <= 0) {
    return 1
  }

  const fitScale = Math.min(width / cols, height / rows, 1)
  if (!Number.isFinite(fitScale) || fitScale <= 0) {
    return 1
  }
  if (fitScale >= 1) {
    return 1
  }

  /**
   * `cols * h / rows` is an integer iff `h` is a multiple of `rows / gcd(cols, rows)`.
   * Pick the largest such `h` that still fits the container.
   */
  const maxTargetH = Math.max(1, Math.floor(rows * fitScale))
  const step = rows / gcd(cols, rows)
  const targetH = Math.floor(maxTargetH / step) * step
  if (targetH < 1) {
    return 1
  }
  return targetH / rows
}
