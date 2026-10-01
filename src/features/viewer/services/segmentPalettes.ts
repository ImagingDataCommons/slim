/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'

/**
 * Two-entry palette for a binary segment: background (0) stays black and
 * transparent, the segment (1) gets `color`.
 */
export function createSegmentPaletteColorLookupTable(
  color: number[],
  applyDisplayGammaCorrection: boolean,
): dmv.color.PaletteColorLookupTable {
  return dmv.color.buildPaletteColorLookupTable({
    data: [[0, 0, 0], color],
    firstValueMapped: 0,
    applyDisplayGammaCorrection,
  })
}

/**
 * Draw each BINARY segment in its color, keeping its opacity. Segments
 * without a color lose their palette.
 */
export function applyBinarySegmentPalettes(
  viewer: dmv.viewer.VolumeImageViewer,
  colors: Readonly<Record<string, number[] | undefined>>,
  applyDisplayGammaCorrection: boolean,
): void {
  for (const [uid, color] of Object.entries(colors)) {
    viewer.setSegmentStyle(uid, {
      opacity: viewer.getSegmentStyle(uid).opacity,
      paletteColorLookupTable:
        color !== undefined
          ? createSegmentPaletteColorLookupTable(
              color,
              applyDisplayGammaCorrection,
            )
          : undefined,
    })
  }
}
