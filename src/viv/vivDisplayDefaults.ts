import type { VivSettings } from '../AppConfig'

const DEFAULT_COLORS: Array<[number, number, number]> = [
  [0, 0, 255],
  [0, 255, 0],
  [255, 255, 255],
  [255, 0, 0],
]

export function buildVivDisplayOptions(
  fullHeight: number,
  fullWidth: number,
  channelCount: number,
  overrides?: VivSettings,
  /** SM pixel bit depth from DICOM; selects sensible default contrast when overrides omit contrastLimits. */
  bitsAllocated: 8 | 16 = 16,
): {
  selections: Array<{ c: number; t: number; z: number }>
  channelsVisible: boolean[]
  contrastLimits: Array<[number, number]>
  colors: Array<[number, number, number]>
  initialViewState: {
    target: [number, number, number]
    zoom: number
  }
} {
  const n =
    overrides?.selections?.length ?? Math.min(4, Math.max(1, channelCount))
  const selections =
    overrides?.selections?.map((s) => ({
      c: s.c,
      t: s.t ?? 0,
      z: s.z ?? 0,
    })) ??
    Array.from({ length: n }, (_, i) => ({
      c: Math.min(i, channelCount - 1),
      t: 0,
      z: 0,
    }))

  const channelsVisible =
    overrides?.channelsVisible ?? selections.map(() => true)

  const defaultContrast: [number, number] =
    bitsAllocated === 8 ? [0, 255] : [1000, 50000]
  const contrastLimits =
    overrides?.contrastLimits ??
    selections.map(() => [...defaultContrast] as [number, number])

  const colors =
    overrides?.colors ??
    selections.map((_, i) => DEFAULT_COLORS[i % DEFAULT_COLORS.length])

  const initialViewState = {
    target:
      overrides?.initialViewState?.target ??
      ([fullWidth / 2, fullHeight / 2, 0] as [number, number, number]),
    zoom: overrides?.initialViewState?.zoom ?? -6,
  }

  return {
    selections,
    channelsVisible,
    contrastLimits,
    colors,
    initialViewState,
  }
}

/** Deck orthographic viewState so the full slide fits the viewport (unless zoom is fixed in config). */
export function computeOrthographicFitViewState(
  vw: number,
  vh: number,
  slideW: number,
  slideH: number,
  pan?: [number, number, number],
): { target: [number, number, number]; zoom: number } | null {
  const w = Math.max(1, Math.floor(vw))
  const h = Math.max(1, Math.floor(vh))
  if (w < 32 || h < 32) {
    return null
  }
  return {
    target: pan ? [pan[0], pan[1], pan[2] ?? 0] : [slideW / 2, slideH / 2, 0],
    zoom: Math.log2(Math.min(w / slideW, h / slideH)),
  }
}

/**
 * OrthographicController defaults to unlimited zoom; Tile2D picks tile z using `ceil(viewport.zoom)` (+ offset).
 * Tiny float drift or extreme zoom can bump tile z and load a different region. Clamp relative to the fit zoom
 * and pyramid depth so the viewport stays aligned with MultiscaleImageLayer tile indexing.
 */
export function orthographicZoomLimits(
  vw: number,
  vh: number,
  slideW: number,
  slideH: number,
  pyramidLevelCount: number,
): { minZoom: number; maxZoom: number } {
  const w = Math.max(1, vw)
  const h = Math.max(1, vh)
  const sw = Math.max(1, slideW)
  const sh = Math.max(1, slideH)
  const fitZ = Math.log2(Math.min(w / sw, h / sh))
  const n = Math.max(1, pyramidLevelCount)
  /** ~one orthographic zoom step per pyramid level toward full-res, then room for magnifying past native tile z=0. */
  return {
    minZoom: fitZ - 2,
    maxZoom: fitZ + Math.max(0, n - 1) + 6,
  }
}

/**
 * Tile index `z` for deck.gl `TileLayer` / Viv `MultiscaleImageLayer` at an orthographic zoom.
 * Matches `getTileIndices` (`Math.ceil(viewport.zoom) + zoomOffset`, then clamped) and Viv
 * `minZoom: -(loader.length - 1)`, `maxZoom: 0`. Loader resolution is `Math.round(-z)` (0 = finest).
 */
export function vivDeckTileZFromViewZoom(
  deckZoom: number,
  pyramidLevelCount: number,
  zoomOffset = 0,
): number {
  const n = Math.max(1, pyramidLevelCount)
  const minZoom = -Math.round(n - 1)
  const maxZoom = 0
  let z = Math.ceil(deckZoom) + zoomOffset
  if (z < minZoom) {
    z = minZoom
  }
  if (z > maxZoom) {
    z = maxZoom
  }
  return z
}

/** True when multiscale tiles use pyramid level 0 (finest), i.e. tile `z === 0`. */
export function isVivAtFinestPyramidTile(
  deckZoom: number,
  pyramidLevelCount: number,
  zoomOffset = 0,
): boolean {
  return vivDeckTileZFromViewZoom(deckZoom, pyramidLevelCount, zoomOffset) === 0
}

/**
 * Nominal on-slide marker diameter for bulk centroids (mm).
 * ~5 µm — same intent as `dicom-microscopy-viewer` POINT style (their constant
 * is mislabeled “micrometer” but is used with mm `PixelSpacing`).
 */
export const VIV_BULK_CENTROID_DIAMETER_MM = 5e-6

/** Heuristic: WSI `PixelSpacing` values above this are usually µm, not mm. */
const PIXEL_SPACING_LIKELY_UM_THRESHOLD_MM = 0.02

function normalizePixelSpacingToMm(
  spacing: [number, number],
): [number, number] {
  const a = spacing[0]
  const b = spacing[1]
  if (Math.min(a, b) > PIXEL_SPACING_LIKELY_UM_THRESHOLD_MM) {
    return [a / 1000, b / 1000]
  }
  return [a, b]
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) {
    return x >= edge1 ? 1 : 0
  }
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Deck zoom at which finest pyramid tiles load (`ceil(zoom) >= 0` → tile z = 0).
 * Centroid LOD is shown for zoom strictly below this gate.
 */
export function deckZoomHighResGate(): number {
  return -1
}

/**
 * Scatterplot radius (px) for bulk centroids.
 *
 * Non-LOD: physical diameter × pixel spacing, in screen pixels (`radius ∝ 2^zoom`).
 *
 * LOD overview: same physical size, but clamped with a **continuous** zoom envelope
 * from “whole slide fits” (`fitZ`) to just before full-resolution paths (`deckZoom ≈ -1`),
 * so markers stay sparse at overview and grow smoothly through intermediate zoom.
 */
export function computeVivBulkCentroidRadiusPixels(options: {
  deckZoom: number
  /** Row/column spacing in mm (finest pyramid level), or µm values > 0.02. */
  pixelSpacingMm: [number, number] | null
  diameterMm?: number
  minPx?: number
  maxPx?: number
  lodOverview?: boolean
  viewportWidth?: number
  viewportHeight?: number
  slideWidth?: number
  slideHeight?: number
}): number {
  const {
    deckZoom,
    pixelSpacingMm,
    diameterMm = VIV_BULK_CENTROID_DIAMETER_MM,
    lodOverview = false,
    viewportWidth,
    viewportHeight,
    slideWidth,
    slideHeight,
  } = options
  const minPx = options.minPx ?? 1
  const maxPx = options.maxPx ?? 8

  if (!Number.isFinite(deckZoom)) {
    return lodOverview ? 0.45 : minPx
  }

  let radiusFromPhysics = minPx
  if (
    pixelSpacingMm != null &&
    pixelSpacingMm[0] > 0 &&
    pixelSpacingMm[1] > 0
  ) {
    const [sx, sy] = normalizePixelSpacingToMm(pixelSpacingMm)
    const spacingMm = Math.min(sx, sy)
    const radiusSlidePx = diameterMm / (2 * spacingMm)
    radiusFromPhysics = radiusSlidePx * 2 ** deckZoom
  }

  if (!lodOverview) {
    return Math.min(maxPx, Math.max(minPx, radiusFromPhysics))
  }

  const hasViewport =
    viewportWidth != null &&
    viewportHeight != null &&
    slideWidth != null &&
    slideHeight != null &&
    slideWidth > 0 &&
    slideHeight > 0

  if (!hasViewport) {
    return Math.min(10, Math.max(0.35, radiusFromPhysics))
  }

  const vw = Math.max(1, viewportWidth)
  const vh = Math.max(1, viewportHeight)
  const fitZ = Math.log2(Math.min(vw / slideWidth, vh / slideHeight))
  const highResGate = deckZoomHighResGate()

  const t = smoothstep(fitZ, highResGate, deckZoom)
  const floorPx = 0.12 + t * 1.4
  const ceilPx = 0.22 + t * 6.5

  let radiusPx = Math.min(ceilPx, Math.max(floorPx, radiusFromPhysics))

  if (deckZoom < fitZ) {
    radiusPx *= 0.75 * 2 ** (deckZoom - fitZ)
  }

  return Math.max(0.1, Math.min(6, radiusPx))
}

/** IDC cyclic IF demo (Lin et al.) — channels 8–11 per viv-dicomweb-test. */
export const IDC_CYCLIC_IF_VIV_SETTINGS: VivSettings = {
  selections: [
    { c: 8, t: 0, z: 0 },
    { c: 9, t: 0, z: 0 },
    { c: 10, t: 0, z: 0 },
    { c: 11, t: 0, z: 0 },
  ],
  channelsVisible: [true, true, true, true],
  contrastLimits: [
    [4000, 40000],
    [3000, 30000],
    [3000, 20000],
    [5000, 50000],
  ],
  colors: [
    [0, 0, 255],
    [0, 255, 0],
    [255, 255, 255],
    [255, 0, 0],
  ],
  initialViewState: {
    target: [21000, 13000, 0],
    zoom: -6,
  },
}
