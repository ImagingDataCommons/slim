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
