// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'

import { getSegmentationType, getSegmentColor } from './segmentColors'

/**
 * Build a perceptually distinct, single-hue palette for the overlay at
 * `index`. Multi-hue scientific color maps (viridis, magma, inferno, hot, …)
 * all share a dark → bright-yellow ramp and are therefore hard to tell apart
 * and to match against the legend; single-hue ramps give each overlay a
 * clearly different, easily named color.
 * See https://github.com/ImagingDataCommons/dicom-microscopy-viewer/issues/240.
 */
function buildDistinctPalette(
  index: number,
): dmv.color.PaletteColorLookupTable {
  const data = dmv.color.createDistinctColormap({ index, bins: 2 ** 8 })
  return dmv.color.buildPaletteColorLookupTable({
    data,
    firstValueMapped: 0,
  })
}

/**
 * When several fractional segments exist, cycle colormaps unless DICOM
 * specifies a display color (Recommended Display CIELab Value).
 * Requires dicom-microscopy-viewer that applies palettes for FRACTIONAL
 * segments in setSegmentStyle (see fork / slim#377).
 */
export function applyDistinctFractionalSegmentPalettes(
  volumeViewer: dmv.viewer.VolumeImageViewer,
): void {
  const segments = volumeViewer.getAllSegments()
  const fractional = segments.filter((seg) => {
    const meta = volumeViewer.getSegmentMetadata(seg.uid)?.[0] as unknown as
      | Record<string, unknown>
      | undefined
    return getSegmentationType(meta) === 'FRACTIONAL'
  })
  if (fractional.length <= 1) {
    return
  }

  let paletteIndex = 0
  fractional.forEach((seg) => {
    const meta0 = volumeViewer.getSegmentMetadata(seg.uid)?.[0] as unknown as
      | Record<string, unknown>
      | undefined
    if (meta0 === undefined) {
      return
    }
    if (getSegmentColor(meta0, seg.number) !== null) {
      return
    }

    const table = buildDistinctPalette(paletteIndex)
    paletteIndex += 1
    const style = volumeViewer.getSegmentStyle(seg.uid)
    volumeViewer.setSegmentStyle(seg.uid, {
      opacity: style.opacity,
      paletteColorLookupTable: table,
    })
  })
}

/**
 * Distinct colormaps for multiple parametric maps (same session).
 */
export function applyDistinctParametricMapPalettes(
  volumeViewer: dmv.viewer.VolumeImageViewer,
): void {
  const mappings = volumeViewer.getAllParameterMappings()
  if (mappings.length <= 1) {
    return
  }

  mappings.forEach((mapping, i) => {
    const table = buildDistinctPalette(i)
    const style = volumeViewer.getParameterMappingStyle(mapping.uid)
    volumeViewer.setParameterMappingStyle(mapping.uid, {
      opacity: style.opacity,
      limitValues: style.limitValues,
      paletteColorLookupTable: table,
    })
  })
}
