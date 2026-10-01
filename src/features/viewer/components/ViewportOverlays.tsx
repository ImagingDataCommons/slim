import type OlMap from 'ol/Map'
import type React from 'react'
import { useCallback } from 'react'

import { Icon, type IconName } from '../../../components/ui/icon'
import { useViewportMetrics } from '../hooks/useViewportMetrics'
import {
  computeScaleBar,
  formatCursorLabel,
  formatMagnificationLabel,
} from '../utils/scaleBar'
import type { SlideAffine } from '../utils/slideCoordinates'

export interface ViewportOverlaysProps {
  /** Returns the viewer's OpenLayers map (DMV bundles its own `ol`). */
  getMap: () => OlMap | undefined
  /** Base-level pixel → slide transform for the cursor readout (mm) */
  slideAffine?: SlideAffine
  slideId: string
  slideDescription?: string
  showSlideLabel?: boolean
  showZoomControls?: boolean
  showViewportInfo?: boolean
}

const ZOOM_ANIMATION_MS = 200

const OVERLAY_CARD =
  'rounded-lg border border-line bg-overlay-card/92 shadow-[0_1px_2px_rgb(var(--shadow-color)/0.06)]'

function ZoomButton({
  icon,
  title,
  size = 20,
  onClick,
}: {
  icon: IconName
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

/** Scale bar, magnification and cursor position card. */
function ViewportInfoCard({
  getMap,
  slideAffine,
}: Pick<ViewportOverlaysProps, 'getMap' | 'slideAffine'>): React.ReactElement {
  const { micronsPerPixel, cursor } = useViewportMetrics(getMap, slideAffine)
  const scaleBar =
    micronsPerPixel !== undefined ? computeScaleBar(micronsPerPixel) : null

  return (
    <div
      className={`pointer-events-none absolute bottom-3.5 left-3.5 z-10 flex items-center gap-3 px-3 py-2 font-mono text-11.5 font-medium text-ink-body ${OVERLAY_CARD}`}
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
        <span>{formatMagnificationLabel(micronsPerPixel)}</span>
        <span>{formatCursorLabel(cursor)}</span>
      </div>
    </div>
  )
}

/**
 * Floating cards over the slide viewport: active slide chip, zoom stack and
 * the scale / magnification / cursor-position card, each of which can be
 * turned off in Preferences. The overview card is DMV's OverviewMap control,
 * styled in `index.css`.
 */
export function ViewportOverlays({
  getMap,
  slideAffine,
  slideId,
  slideDescription,
  showSlideLabel = true,
  showZoomControls = true,
  showViewportInfo = true,
}: ViewportOverlaysProps): React.ReactElement {
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

  return (
    <>
      {showSlideLabel && (
        <div className="pointer-events-none absolute left-3.5 top-3.5 z-10 flex flex-col gap-1.5">
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 ${OVERLAY_CARD}`}
          >
            <span
              className="max-w-[220px] truncate text-12.5 font-semibold text-ink"
              title={slideId}
            >
              {slideId}
            </span>
            {slideDescription !== undefined && slideDescription !== '' && (
              <span className="max-w-[220px] truncate text-12 text-ink-muted">
                {slideDescription}
              </span>
            )}
          </div>
        </div>
      )}

      {showZoomControls && (
        <div className="absolute right-3.5 top-3.5 z-10 flex flex-col overflow-hidden rounded-card border border-line bg-panel shadow-overlay">
          <ZoomButton icon="add" title="Zoom in" onClick={() => zoomBy(1)} />
          <div className="h-px bg-line-soft" />
          <ZoomButton
            icon="remove"
            title="Zoom out"
            onClick={() => zoomBy(-1)}
          />
          <div className="h-px bg-line-soft" />
          <ZoomButton
            icon="fit_screen"
            title="Fit to view"
            size={19}
            onClick={fitToView}
          />
        </div>
      )}

      {showViewportInfo && (
        <ViewportInfoCard getMap={getMap} slideAffine={slideAffine} />
      )}
    </>
  )
}
