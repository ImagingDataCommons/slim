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

/**
 * ICC color profile of the slide. DMV first draws tiles without color
 * correction, fetches the profiles, then swaps in a corrected tile loader,
 * which drops the drawn tiles: the image blanks and is drawn again.
 *
 * - `none`: no profile expected, or it has been applied
 * - `fetching`: the image has a profile that DMV has not fetched yet
 * - `applying`: tiles are being loaded again with the profile
 * - `drawing`: they have loaded; decoding, color correction and drawing
 *   happen after, until the map has rendered them
 */
export type ColorProfilePhase = 'none' | 'fetching' | 'applying' | 'drawing'

export interface ViewportLoading {
  /** Drives the busy cursor */
  isLoading: boolean
  phase: ViewportLoadingPhase
  colorProfile: ColorProfilePhase
}

export const INITIAL_VIEWPORT_LOADING: ViewportLoading = {
  isLoading: false,
  phase: INITIAL_VIEWPORT_LOADING_PHASE,
  colorProfile: 'none',
}

export type ViewportLoadingAction =
  /** New viewers; `expectsColorProfile` when the image has an ICC profile */
  | { type: 'reset'; expectsColorProfile?: boolean }
  | { type: 'loadingStarted' }
  | { type: 'loadingEnded' }
  | { type: 'loadingFailed' }
  /** A frame was requested; `hasColorProfiles` once DMV fetched them */
  | { type: 'frameStarted'; hasColorProfiles: boolean }
  /** A frame finished loading; `hasPendingFrames` tells whether others remain */
  | { type: 'frameSettled'; hasPendingFrames: boolean }
  /** The map rendered every tile in view after the corrected tiles loaded */
  | { type: 'colorProfileDrawn' }
  /** The profile never arrived (failed fetch); stop announcing it */
  | { type: 'colorProfileTimedOut' }

function nextLoading(
  state: ViewportLoading,
  isLoading: boolean,
  phase: ViewportLoadingPhase,
  colorProfile: ColorProfilePhase = state.colorProfile,
): ViewportLoading {
  return state.isLoading === isLoading &&
    state.phase === phase &&
    state.colorProfile === colorProfile
    ? state
    : { isLoading, phase, colorProfile }
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
        action.expectsColorProfile === true ? 'fetching' : 'none',
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
    case 'frameStarted':
      /** The first request after the profiles arrived redraws the image */
      return state.colorProfile === 'fetching' && action.hasColorProfiles
        ? nextLoading(state, state.isLoading, state.phase, 'applying')
        : state
    case 'frameSettled':
      return nextLoading(
        state,
        action.hasPendingFrames,
        action.hasPendingFrames
          ? state.phase
          : nextViewportLoadingPhase(state.phase, 'ended'),
        state.colorProfile === 'applying' && !action.hasPendingFrames
          ? 'drawing'
          : state.colorProfile,
      )
    case 'colorProfileDrawn':
      return state.colorProfile === 'drawing'
        ? nextLoading(state, state.isLoading, state.phase, 'none')
        : state
    case 'colorProfileTimedOut':
      return nextLoading(state, state.isLoading, state.phase, 'none')
  }
}

/**
 * What the viewport status pill says, if anything: the first image, then
 * the color profile that will redraw it
 */
export function viewportStatusLabel(
  state: ViewportLoading,
): string | undefined {
  if (isViewportLoading(state.phase)) return 'Loading slide'
  if (state.colorProfile !== 'none') return 'Applying color profile'
  return undefined
}
