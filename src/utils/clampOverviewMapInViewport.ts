import { getCenter, getHeight, getWidth } from 'ol/extent'
import type OlMap from 'ol/Map'
import type View from 'ol/View'

import {
  fitOverviewMapSize,
  OVERVIEW_EDGE_INSET_PX,
  overviewMapSizeBounds,
} from './fitOverviewMapSize'

/** OpenLayers View internals used to retarget locked overview resolutions. */
type OverviewViewInternals = View & {
  applyOptions_: (options: Record<string, unknown>) => void
  getUpdatedOptions_: (
    options: Record<string, unknown>,
  ) => Record<string, unknown>
}

function verticalChromePx(mapEl: HTMLElement): number {
  const style = window.getComputedStyle(mapEl)
  const read = (prop: string): number =>
    Number.parseFloat(style.getPropertyValue(prop)) || 0
  return (
    read('margin-top') +
    read('margin-bottom') +
    read('padding-top') +
    read('padding-bottom') +
    read('border-top-width') +
    read('border-bottom-width')
  )
}

function horizontalChromePx(mapEl: HTMLElement): number {
  const style = window.getComputedStyle(mapEl)
  const read = (prop: string): number =>
    Number.parseFloat(style.getPropertyValue(prop)) || 0
  return (
    read('margin-left') +
    read('margin-right') +
    read('padding-left') +
    read('padding-right') +
    read('border-left-width') +
    read('border-right-width')
  )
}

/**
 * Locate DMV's OverviewMap control via Symbol-keyed private fields (no public
 * API on the published package), then sync OL size + view after CSS resize.
 *
 * DMV locks overview `minResolution === maxResolution` and pins the center via
 * a point `extent` + `constrainOnlyCenter` so OpenLayers' OverviewMap cannot
 * rezoom/recenter when the main-map box shrinks on zoom (`resetExtent_`).
 * After Slim shrinks the map for chrome / max-fraction, retarget that locked
 * resolution to the post-resize map size — and re-apply the center pin.
 *
 * Do not `setView(new View)`: DMV bundles its own `ol`, so a Slim `View` fails
 * `instanceof` and OL treats it as a Promise (`view.then`).
 */
function syncOverviewOpenLayersMap(volumeViewer: object): void {
  for (const symbol of Object.getOwnPropertySymbols(volumeViewer)) {
    const value = (volumeViewer as Record<symbol, unknown>)[symbol]
    if (
      value == null ||
      typeof value !== 'object' ||
      typeof (value as { getOverviewMap?: unknown }).getOverviewMap !==
        'function'
    ) {
      continue
    }
    const overviewOlMap = (
      value as { getOverviewMap: () => OlMap }
    ).getOverviewMap()
    overviewOlMap.updateSize()
    const view = overviewOlMap.getView() as OverviewViewInternals | undefined
    const projection = view?.getProjection()
    const extent = projection?.getExtent()
    const size = overviewOlMap.getSize()
    if (
      view == null ||
      extent == null ||
      size == null ||
      !(size[0] > 0) ||
      !(size[1] > 0) ||
      typeof view.applyOptions_ !== 'function' ||
      typeof view.getUpdatedOptions_ !== 'function'
    ) {
      return
    }

    const rotation = view.getRotation()
    const degrees = (rotation / Math.PI) * 180
    const isRotated = !(
      Math.abs(degrees - 180) < 0.01 || Math.abs(degrees - 0) < 0.01
    )
    /** Same formula as DMV `_updateOverviewMapSize` (height-driven). */
    const resolution = isRotated
      ? getWidth(extent) / size[1]
      : getHeight(extent) / size[1]
    if (!(resolution > 0) || !Number.isFinite(resolution)) {
      return
    }

    const center = getCenter(extent)
    view.applyOptions_(
      view.getUpdatedOptions_({
        minResolution: resolution,
        maxResolution: resolution,
        resolution,
        center,
        /** Keep the overview pinned to the full-slide center on zoom. */
        extent: center.concat(center),
        constrainOnlyCenter: true,
        showFullExtent: true,
      }),
    )
    return
  }
}

export type ClampOverviewMapOptions = {
  /**
   * VolumeImageViewer instance. When provided, retargets the overview view's
   * locked resolution after CSS size changes (DOM `resize` events do not).
   */
  volumeViewer?: object
}

/**
 * Fit overview map size into the viewport symmetrically for wide and tall
 * slides, keep left/bottom insets equal.
 *
 * Runtime note: Slim applies this because craco loads the published DMV min
 * bundle; local `dicom-microscopy-viewer/src/viewer.js` sizing changes do not
 * ship until that package is published and bumped.
 */
export function clampOverviewMapInViewport(
  container: HTMLElement,
  options: ClampOverviewMapOptions = {},
): void {
  const overview = container.querySelector('.ol-overviewmap')
  const mapEl = container.querySelector('.ol-overviewmap-map')
  if (!(overview instanceof HTMLElement) || !(mapEl instanceof HTMLElement)) {
    return
  }

  const chromeY = verticalChromePx(mapEl)
  const chromeX = horizontalChromePx(mapEl)
  const bounds = overviewMapSizeBounds(
    container.clientWidth,
    container.clientHeight,
    chromeX,
    chromeY,
  )

  overview.style.left = `${OVERVIEW_EDGE_INSET_PX}px`
  overview.style.bottom = `${OVERVIEW_EDGE_INSET_PX}px`
  overview.style.top = 'auto'
  overview.style.margin = '0'
  mapEl.style.margin = '0'

  const height =
    Number.parseFloat(mapEl.style.height || '') || mapEl.clientHeight
  const width = Number.parseFloat(mapEl.style.width || '') || mapEl.clientWidth
  if (!(height > 0) || !(width > 0)) {
    return
  }

  const fitted = fitOverviewMapSize(width, height, bounds)
  const sizeChanged =
    Math.abs(fitted.width - width) > 0.5 ||
    Math.abs(fitted.height - height) > 0.5

  if (sizeChanged) {
    mapEl.style.width = `${fitted.width}px`
    mapEl.style.height = `${fitted.height}px`
    /**
     * Only retarget the locked overview resolution when the CSS size changed.
     * Zoom updates the overview *box* styles and would otherwise re-enter here
     * via MutationObserver; repeatedly rewriting view options on every box
     * paint is unnecessary once size (and thus resolution) is stable.
     */
    if (options.volumeViewer != null) {
      syncOverviewOpenLayersMap(options.volumeViewer)
    }
  }

  /**
   * Match bottom gap to left gap using the visible map border vs the volume
   * container.
   */
  const containerRect = container.getBoundingClientRect()
  const mapRect = mapEl.getBoundingClientRect()
  const leftGap = mapRect.left - containerRect.left
  const bottomGap = containerRect.bottom - mapRect.bottom
  if (leftGap >= 0 && bottomGap - leftGap > 0.5) {
    overview.style.bottom = `${Math.max(0, OVERVIEW_EDGE_INSET_PX - (bottomGap - leftGap))}px`
  } else if (leftGap >= 0) {
    overview.style.bottom = `${leftGap}px`
  }
}

/**
 * Re-run {@link clampOverviewMapInViewport} when DMV rebuilds or resizes the
 * overview control (it sets inline width/height asynchronously).
 */
export function observeOverviewMapClamp(
  container: HTMLElement,
  options: ClampOverviewMapOptions = {},
): () => void {
  let scheduled = false
  let isClamping = false

  const clamp = (): void => {
    if (scheduled || isClamping) {
      return
    }
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      isClamping = true
      try {
        clampOverviewMapInViewport(container, options)
      } finally {
        isClamping = false
      }
    })
  }

  const mutationObserver = new MutationObserver(() => {
    if (isClamping) {
      return
    }
    clamp()
  })
  mutationObserver.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  })

  const resizeObserver = new ResizeObserver(clamp)
  resizeObserver.observe(container)

  clamp()

  return () => {
    mutationObserver.disconnect()
    resizeObserver.disconnect()
  }
}
