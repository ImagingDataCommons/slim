/**
 * Loading of the overlays drawn over the slide: segmentation and parametric
 * map frames, and bulk annotation features. The slide's own first image has
 * its own status pill; this one tells that overlays the user turned on are
 * still on their way.
 */
export type OverlayKind = 'segments' | 'maps' | 'annotations'

export interface OverlayLoading {
  /** Loads in flight, by key, with what they load */
  pending: ReadonlyMap<string, OverlayKind>
  /** Frames started since overlays were last idle */
  frameTotal: number
  /** Of those, frames that finished (or failed) */
  frameSettled: number
}

export const INITIAL_OVERLAY_LOADING: OverlayLoading = {
  pending: new Map(),
  frameTotal: 0,
  frameSettled: 0,
}

export type OverlayLoadingAction =
  | { type: 'started'; key: string; kind: OverlayKind }
  | { type: 'settled'; key: string }
  /** New slide, or loads that never reported their end */
  | { type: 'reset' }

/** Unchanged states keep their identity so no re-render follows */
export function overlayLoadingReducer(
  state: OverlayLoading,
  action: OverlayLoadingAction,
): OverlayLoading {
  switch (action.type) {
    case 'started': {
      if (state.pending.has(action.key)) return state
      const pending = new Map(state.pending)
      pending.set(action.key, action.kind)
      return {
        pending,
        frameTotal: state.frameTotal + (action.kind === 'annotations' ? 0 : 1),
        frameSettled: state.frameSettled,
      }
    }
    case 'settled': {
      const kind = state.pending.get(action.key)
      if (kind === undefined) return state
      if (state.pending.size === 1) return INITIAL_OVERLAY_LOADING
      const pending = new Map(state.pending)
      pending.delete(action.key)
      return {
        pending,
        frameTotal: state.frameTotal,
        frameSettled: state.frameSettled + (kind === 'annotations' ? 0 : 1),
      }
    }
    case 'reset':
      return state.pending.size === 0 && state.frameTotal === 0
        ? state
        : INITIAL_OVERLAY_LOADING
  }
}

const KIND_LABELS: Record<OverlayKind, string> = {
  segments: 'segments',
  maps: 'parametric maps',
  annotations: 'annotations',
}

export interface OverlayStatus {
  /** What is loading, e.g. "Loading segments"; announced once */
  label: string
  /** How far along the frames are, e.g. "12 of 41 frames"; shown only */
  progress: string | undefined
}

/** What the overlay status pill says, if anything */
export function overlayStatus(
  state: OverlayLoading,
): OverlayStatus | undefined {
  if (state.pending.size === 0) return undefined
  const kinds = new Set(state.pending.values())
  const what = kinds.size === 1 ? KIND_LABELS[[...kinds][0]] : 'overlays'
  return {
    label: `Loading ${what}`,
    progress:
      state.frameTotal > 1
        ? `${String(state.frameSettled)} of ${String(state.frameTotal)} frames`
        : undefined,
  }
}
