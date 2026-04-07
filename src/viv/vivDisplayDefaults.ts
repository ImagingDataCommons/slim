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

  const contrastLimits =
    overrides?.contrastLimits ??
    selections.map(() => [1000, 50000] as [number, number])

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
