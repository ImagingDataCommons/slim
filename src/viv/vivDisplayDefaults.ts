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
  // ~one orthographic zoom step per pyramid level toward full-res, then room for magnifying past native tile z=0.
  return {
    minZoom: fitZ - 2,
    maxZoom: fitZ + Math.max(0, n - 1) + 6,
  }
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
