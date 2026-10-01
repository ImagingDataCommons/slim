import type { Coordinate } from 'ol/coordinate'
import type OlMap from 'ol/Map'
import type MapBrowserEvent from 'ol/MapBrowserEvent'
import { useEffect, useState } from 'react'

import { micronsPerScreenPixel } from '../utils/scaleBar'
import {
  imageToSlideCoordinates,
  type SlideAffine,
} from '../utils/slideCoordinates'

export interface ViewportMetrics {
  micronsPerPixel: number | undefined
  /** Pointer position in slide coordinates (mm) */
  cursor: [number, number] | undefined
}

function readMicronsPerPixel(map: OlMap): number | undefined {
  const view = map.getView()
  const projection = view.getProjection()
  return micronsPerScreenPixel({
    resolution: view.getResolution(),
    center: view.getCenter(),
    metersPerUnit: projection.getMetersPerUnit(),
    pointResolution: projection.getPointResolutionFunc(),
  })
}

/**
 * Subscribes to the viewer's OpenLayers map for the scale card. Remount the
 * caller when DMV rebuilds the viewer, since `getMap` is read once. Cursor
 * updates are coalesced to one per animation frame.
 */
export function useViewportMetrics(
  getMap: () => OlMap | undefined,
  slideAffine: SlideAffine | undefined,
): ViewportMetrics {
  const [micronsPerPixel, setMicronsPerPixel] = useState<number | undefined>()
  const [cursor, setCursor] = useState<[number, number] | undefined>()

  useEffect(() => {
    const map = getMap()
    if (map === undefined) return
    let latestCoordinate: Coordinate | undefined
    let frameId: number | undefined

    const flushCursor = (): void => {
      frameId = undefined
      setCursor(
        slideAffine !== undefined && latestCoordinate !== undefined
          ? imageToSlideCoordinates(latestCoordinate, slideAffine)
          : undefined,
      )
    }
    const cancelPendingCursor = (): void => {
      if (frameId !== undefined) cancelAnimationFrame(frameId)
      frameId = undefined
    }
    const updateResolution = (): void => {
      setMicronsPerPixel(readMicronsPerPixel(map))
    }
    const updateCursor = (event: MapBrowserEvent): void => {
      latestCoordinate = event.coordinate
      if (frameId === undefined) frameId = requestAnimationFrame(flushCursor)
    }
    const clearCursor = (): void => {
      cancelPendingCursor()
      latestCoordinate = undefined
      setCursor(undefined)
    }
    const viewport = map.getViewport()
    updateResolution()
    map.on('moveend', updateResolution)
    map.on('pointermove', updateCursor)
    viewport.addEventListener('pointerleave', clearCursor)
    return () => {
      cancelPendingCursor()
      map.un('moveend', updateResolution)
      map.un('pointermove', updateCursor)
      viewport.removeEventListener('pointerleave', clearCursor)
    }
  }, [getMap, slideAffine])

  return { micronsPerPixel, cursor }
}
