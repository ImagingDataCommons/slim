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
 * correction, fetches the profiles, then swaps in a corrected tile loader
 * and draws the image again. Toggling profiles swaps the loader the same way.
 *
 * - `none`: no profile expected, or it has been applied
 * - `fetching`: the image has a profile that DMV has not fetched yet
 * - `requested`: profiles were toggled; DMV has not requested new tiles yet
 * - `swapping`: profiles were toggled and DMV reports when its tile loaders
 *   are swapped; the next completed render shows the new colors
 * - `applying`: tiles are being loaded again with the profile
 * - `drawing`: they have loaded; decoding, color correction and drawing
 *   happen after, until the map has rendered them
 */
export type ColorProfilePhase =
  | 'none'
  | 'fetching'
  | 'requested'
  | 'swapping'
  | 'applying'
  | 'drawing'

export interface ViewportLoading {
  /** Drives the busy cursor */
  isLoading: boolean
  phase: ViewportLoadingPhase
  colorProfile: ColorProfilePhase
  /** The color profile phase follows a user toggle, not the first load */
  isColorProfileToggle: boolean
}

export const INITIAL_VIEWPORT_LOADING: ViewportLoading = {
  isLoading: false,
  phase: INITIAL_VIEWPORT_LOADING_PHASE,
  colorProfile: 'none',
  isColorProfileToggle: false,
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
  /**
   * The user turned ICC profiles on or off; the image is drawn again.
   * `awaitsSwap` when DMV will report the swap of its tile loaders
   */
  | { type: 'colorProfileToggled'; awaitsSwap?: boolean }
  /** DMV swapped its tile loaders after a toggle */
  | { type: 'colorProfileSwapped' }

function nextLoading(
  state: ViewportLoading,
  isLoading: boolean,
  phase: ViewportLoadingPhase,
  colorProfile: ColorProfilePhase = state.colorProfile,
  isColorProfileToggle: boolean = state.isColorProfileToggle,
): ViewportLoading {
  /** A settled profile no longer belongs to a toggle */
  const isToggle = colorProfile !== 'none' && isColorProfileToggle
  return state.isLoading === isLoading &&
    state.phase === phase &&
    state.colorProfile === colorProfile &&
    state.isColorProfileToggle === isToggle
    ? state
    : { isLoading, phase, colorProfile, isColorProfileToggle: isToggle }
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
        false,
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
      /**
       * The first request after the profiles arrived, or after a toggle,
       * redraws the image
       */
      return (state.colorProfile === 'fetching' && action.hasColorProfiles) ||
        state.colorProfile === 'requested'
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
    case 'colorProfileToggled':
      return nextLoading(
        state,
        state.isLoading,
        state.phase,
        action.awaitsSwap === true ? 'swapping' : 'requested',
        true,
      )
    case 'colorProfileSwapped':
      /**
       * OpenLayers fires rendercomplete only once no tile is loading, so the
       * next one after the swap means the new colors are drawn
       */
      return state.colorProfile === 'swapping'
        ? nextLoading(state, state.isLoading, state.phase, 'drawing')
        : state
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
  if (state.colorProfile === 'none') return undefined
  return state.isColorProfileToggle
    ? 'Updating colors'
    : 'Applying color profile'
}
