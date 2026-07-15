/** Default slide-list preview height (see {@link SlideItem}). */
export const SLIDE_PREVIEW_HEIGHT_PX = 100

/** Fallback width when the container has not been laid out yet. */
export const SLIDE_PREVIEW_FALLBACK_WIDTH_PX = 280

export type OverviewPreviewMatrixSize = {
  TotalPixelMatrixColumns: number
  TotalPixelMatrixRows: number
}

/**
 * Scale factor for {@link OverviewImageViewer}'s `resizeFactor` so the DICOMweb
 * rendered preview extent matches the slide-list tile and the server returns a
 * reasonably sized PNG (via the viewport query param when factor &lt; 1).
 *
 * Without this, THUMBNAIL / large OVERVIEW instances keep the full-slide
 * TotalPixelMatrix extent while the rendered image is much smaller — the preview
 * shows a tiny image in a huge canvas or fails to fit (#399).
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

  const width =
    containerWidth > 0 ? containerWidth : SLIDE_PREVIEW_FALLBACK_WIDTH_PX
  const height = containerHeight > 0 ? containerHeight : SLIDE_PREVIEW_HEIGHT_PX

  const scale = Math.min(width / cols, height / rows, 1)
  if (!Number.isFinite(scale) || scale <= 0) {
    return 1
  }
  /** Keep the DICOMweb viewport request at least one pixel per axis. */
  return Math.max(scale, 1 / cols, 1 / rows)
}
