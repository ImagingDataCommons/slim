/**
 * Tracks whether the viewport is still waiting for its first image.
 *
 * - `waiting`: viewer rendered, no tile requested yet
 * - `loading`: first tiles are on their way
 * - `ready`: the first batch finished (or failed); later pans and zooms
 *   do not bring the indicator back
 */
export type ViewportLoadingPhase = 'waiting' | 'loading' | 'ready'

export type ViewportLoadingEvent = 'reset' | 'started' | 'ended' | 'failed'

export const INITIAL_VIEWPORT_LOADING_PHASE: ViewportLoadingPhase = 'waiting'

export function nextViewportLoadingPhase(
  phase: ViewportLoadingPhase,
  event: ViewportLoadingEvent,
): ViewportLoadingPhase {
  switch (event) {
    case 'reset':
      return 'waiting'
    case 'started':
      return phase === 'ready' ? 'ready' : 'loading'
    case 'ended':
    case 'failed':
      return 'ready'
  }
}

export function isViewportLoading(phase: ViewportLoadingPhase): boolean {
  return phase !== 'ready'
}

export interface ViewportLoading {
  /** Drives the busy cursor */
  isLoading: boolean
  phase: ViewportLoadingPhase
}

export const INITIAL_VIEWPORT_LOADING: ViewportLoading = {
  isLoading: false,
  phase: INITIAL_VIEWPORT_LOADING_PHASE,
}

export type ViewportLoadingAction =
  | { type: 'reset' }
  | { type: 'loadingStarted' }
  | { type: 'loadingEnded' }
  | { type: 'loadingFailed' }
  /** A frame finished loading; `hasPendingFrames` tells whether others remain */
  | { type: 'frameSettled'; hasPendingFrames: boolean }

function nextLoading(
  state: ViewportLoading,
  isLoading: boolean,
  phase: ViewportLoadingPhase,
): ViewportLoading {
  return state.isLoading === isLoading && state.phase === phase
    ? state
    : { isLoading, phase }
}

/** Unchanged states keep their identity so no re-render follows */
export function viewportLoadingReducer(
  state: ViewportLoading,
  action: ViewportLoadingAction,
): ViewportLoading {
  switch (action.type) {
    case 'reset':
      return nextLoading(
        state,
        false,
        nextViewportLoadingPhase(state.phase, 'reset'),
      )
    case 'loadingStarted':
      return nextLoading(
        state,
        true,
        nextViewportLoadingPhase(state.phase, 'started'),
      )
    case 'loadingEnded':
      return nextLoading(
        state,
        false,
        nextViewportLoadingPhase(state.phase, 'ended'),
      )
    case 'loadingFailed':
      return nextLoading(
        state,
        state.isLoading,
        nextViewportLoadingPhase(state.phase, 'failed'),
      )
    case 'frameSettled':
      return nextLoading(
        state,
        action.hasPendingFrames,
        action.hasPendingFrames
          ? state.phase
          : nextViewportLoadingPhase(state.phase, 'ended'),
      )
  }
}
