import { getCenter, getHeight, getWidth } from 'ol/extent'
import type OlMap from 'ol/Map'
import type View from 'ol/View'

import {
  constrainBoundsToCard,
  fitOverviewMapSize,
  overviewMapSizeBounds,
} from './fitOverviewMapSize'

/** Overview card offset from the right/bottom viewport edges (px). */
const OVERVIEW_CARD_INSET_PX = 14

/** Card padding (2px) and border (1px) on both sides of the mini-map (px). */
const OVERVIEW_CARD_CHROME_PX = 6

/** Inner mini-map box of the 192px-wide overview card (px). */
const OVERVIEW_CARD_MAP_WIDTH_PX = 186
const OVERVIEW_CARD_MAP_HEIGHT_PX = 120

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
 * Fit overview map size into the bottom-right overview card of the viewport.
 *
 * Slim owns runtime inset/size because it loads the published DMV bundle;
 * keep constants in sync with DMV `_updateOverviewMapSize` /
 * {@link fitOverviewMapSize}.
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

  const chromeY = verticalChromePx(mapEl) + OVERVIEW_CARD_CHROME_PX
  const chromeX = horizontalChromePx(mapEl) + OVERVIEW_CARD_CHROME_PX
  const bounds = constrainBoundsToCard(
    overviewMapSizeBounds(
      container.clientWidth,
      container.clientHeight,
      chromeX,
      chromeY,
    ),
    { width: OVERVIEW_CARD_MAP_WIDTH_PX, height: OVERVIEW_CARD_MAP_HEIGHT_PX },
  )

  overview.style.right = `${OVERVIEW_CARD_INSET_PX}px`
  overview.style.bottom = `${OVERVIEW_CARD_INSET_PX}px`
  overview.style.top = 'auto'
  overview.style.left = 'auto'
  overview.style.margin = '0'
  mapEl.style.margin = '0'
  mapEl.style.padding = '0'

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
}

/**
 * Re-run {@link clampOverviewMapInViewport} when DMV rebuilds or resizes the
 * overview control. Volume `resize()` runs only from ResizeObserver so mutation
 * clamping cannot feedback through OL style updates.
 */
export function observeOverviewMapClamp(
  container: HTMLElement,
  options: ClampOverviewMapOptions = {},
): () => void {
  let clampFrame: number | undefined
  let isClamping = false
  let resizeFrame: number | undefined

  const clamp = (): void => {
    if (clampFrame !== undefined || isClamping) {
      return
    }
    clampFrame = requestAnimationFrame(() => {
      clampFrame = undefined
      isClamping = true
      try {
        clampOverviewMapInViewport(container, options)
      } finally {
        isClamping = false
      }
    })
  }

  const onContainerResize = (): void => {
    if (resizeFrame !== undefined) {
      return
    }
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = undefined
      const viewer = options.volumeViewer as { resize?: () => void } | undefined
      viewer?.resize?.()
      clamp()
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

  const resizeObserver = new ResizeObserver(onContainerResize)
  resizeObserver.observe(container)

  clamp()

  /** Pending frames would otherwise resize a viewer that was cleaned up */
  return () => {
    mutationObserver.disconnect()
    resizeObserver.disconnect()
    if (clampFrame !== undefined) cancelAnimationFrame(clampFrame)
    if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
    clampFrame = undefined
    resizeFrame = undefined
  }
}
