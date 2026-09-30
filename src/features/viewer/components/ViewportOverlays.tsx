import type OlMap from 'ol/Map'
import type MapBrowserEvent from 'ol/MapBrowserEvent'
import type React from 'react'
import { useCallback, useEffect, useState } from 'react'

import { Icon } from '../../../components/ui/icon'
import { formatGroupedNumber } from '../../../utils/displayFormat'
import {
  computeScaleBar,
  formatMagnification,
  formatMicronsPerPixel,
} from '../utils/scaleBar'

export interface ViewportOverlaysProps {
  /** Returns the viewer's OpenLayers map (DMV bundles its own `ol`). */
  getMap: () => OlMap | undefined
  slideId: string
  slideDescription?: string
}

const ZOOM_ANIMATION_MS = 200

const OVERLAY_CARD =
  'rounded-lg border border-line bg-overlay-card/[0.92] shadow-[0_1px_2px_rgb(var(--shadow-color)/0.06)]'

function micronsPerScreenPixel(map: OlMap): number | undefined {
  const view = map.getView()
  const resolution = view.getResolution()
  const center = view.getCenter()
  if (resolution === undefined || center === undefined) return undefined
  const projection = view.getProjection()
  const pointResolution = projection.getPointResolutionFunc()
  const meters =
    pointResolution !== undefined
      ? pointResolution(resolution, center)
      : resolution * (projection.getMetersPerUnit() ?? 1)
  return meters * 1e6
}

function ZoomButton({
  icon,
  title,
  size = 20,
  onClick,
}: {
  icon: string
  title: string
  size?: number
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center text-ink-body transition-colors hover:bg-app"
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

/**
 * Floating cards over the slide viewport: active slide chip, zoom stack and
 * the scale / magnification / cursor-position card. The overview card is
 * DMV's OverviewMap control, styled in `index.css`.
 */
export function ViewportOverlays({
  getMap,
  slideId,
  slideDescription,
}: ViewportOverlaysProps): React.ReactElement {
  const [micronsPerPixel, setMicronsPerPixel] = useState<number | undefined>()
  const [cursor, setCursor] = useState<[number, number] | undefined>()

  useEffect(() => {
    const map = getMap()
    if (map === undefined) return
    const updateResolution = (): void => {
      setMicronsPerPixel(micronsPerScreenPixel(map))
    }
    const updateCursor = (event: MapBrowserEvent): void => {
      const [x, y] = event.coordinate
      setCursor([Math.round(x), Math.round(Math.abs(y))])
    }
    updateResolution()
    map.on('moveend', updateResolution)
    map.on('pointermove', updateCursor)
    return () => {
      map.un('moveend', updateResolution)
      map.un('pointermove', updateCursor)
    }
  }, [getMap])

  const zoomBy = useCallback(
    (delta: number): void => {
      const view = getMap()?.getView()
      const zoom = view?.getZoom()
      if (view === undefined || zoom === undefined) return
      view.animate({ zoom: zoom + delta, duration: ZOOM_ANIMATION_MS })
    },
    [getMap],
  )

  const fitToView = useCallback((): void => {
    const map = getMap()
    if (map === undefined) return
    const view = map.getView()
    const extent = view.getProjection().getExtent()
    if (extent === null) return
    view.fit(extent, { size: map.getSize(), duration: ZOOM_ANIMATION_MS })
  }, [getMap])

  const scaleBar =
    micronsPerPixel !== undefined ? computeScaleBar(micronsPerPixel) : null
  const magnificationLabel =
    micronsPerPixel !== undefined
      ? `${formatMagnification(micronsPerPixel)} · ${formatMicronsPerPixel(micronsPerPixel)} µm/px`
      : '— · — µm/px'
  const cursorLabel =
    cursor !== undefined
      ? `x ${formatGroupedNumber(cursor[0])} · y ${formatGroupedNumber(cursor[1])}`
      : 'x — · y —'

  return (
    <>
      <div className="pointer-events-none absolute left-3.5 top-3.5 z-10 flex flex-col gap-1.5">
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 ${OVERLAY_CARD}`}
        >
          <span className="text-[12.5px] font-semibold text-ink">
            {slideId}
          </span>
          {slideDescription !== undefined && slideDescription !== '' && (
            <span className="text-[12px] text-ink-muted">
              {slideDescription}
            </span>
          )}
        </div>
      </div>

      <div className="absolute right-3.5 top-3.5 z-10 flex flex-col overflow-hidden rounded-[10px] border border-line bg-panel shadow-overlay">
        <ZoomButton icon="add" title="Zoom in" onClick={() => zoomBy(1)} />
        <div className="h-px bg-line-soft" />
        <ZoomButton icon="remove" title="Zoom out" onClick={() => zoomBy(-1)} />
        <div className="h-px bg-line-soft" />
        <ZoomButton
          icon="fit_screen"
          title="Fit to view"
          size={19}
          onClick={fitToView}
        />
      </div>

      <div
        className={`pointer-events-none absolute bottom-3.5 left-3.5 z-10 flex items-center gap-3 px-3 py-2 font-mono text-[11.5px] font-medium text-ink-body ${OVERLAY_CARD}`}
      >
        <div className="flex flex-col gap-1">
          <div
            className="h-1.5 border-2 border-t-0 border-ink"
            style={{ width: scaleBar?.widthPx ?? 96 }}
          />
          <div>{scaleBar?.label ?? '—'}</div>
        </div>
        <div className="h-[26px] w-px bg-line" />
        <div className="flex flex-col gap-[3px] text-ink-secondary">
          <span>{magnificationLabel}</span>
          <span>{cursorLabel}</span>
        </div>
      </div>
    </>
  )
}
