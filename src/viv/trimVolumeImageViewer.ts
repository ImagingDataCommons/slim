// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'

import { logger } from '../utils/logger'

type OpticalPathLayer = {
  layer: { getSource?: () => { clear?: () => void } | null }
}

/**
 * After Viv has cached OpenLayers `loader_` functions, trim map footprint:
 * drop overview control, clear decoded tile caches, shrink the hidden map to 1×1.
 * Tile loaders keep working; pyramid metadata on the viewer is unchanged.
 */
export function trimVolumeImageViewerFootprint(
  viewer: dmv.viewer.VolumeImageViewer,
  opticalPaths: Record<string, OpticalPathLayer>,
): void {
  try {
    const record = viewer as unknown as Record<symbol, unknown>
    const map = record[Symbol.for('map')] as
      | {
          removeControl?: (c: unknown) => void
          setSize?: (size: [number, number]) => void
          updateSize?: () => void
        }
      | undefined
    if (map == null) {
      return
    }

    const overviewSym = Object.getOwnPropertySymbols(viewer).find(
      (s) => s.description === 'overviewMap',
    )
    if (overviewSym !== undefined) {
      const overview = record[overviewSym]
      if (overview != null && typeof map.removeControl === 'function') {
        map.removeControl(overview)
      }
    }

    for (const entry of Object.values(opticalPaths)) {
      const source = entry.layer.getSource?.()
      if (source != null && typeof source.clear === 'function') {
        source.clear()
      }
    }

    if (typeof map.setSize === 'function') {
      map.setSize([1, 1])
    }
    map.updateSize?.()
  } catch (err) {
    logger.debug('[Viv] trimVolumeImageViewerFootprint failed', err)
  }
}
