import {
  INITIAL_VIEWPORT_LOADING_PHASE,
  isViewportLoading,
  nextViewportLoadingPhase,
  type ViewportLoadingEvent,
  type ViewportLoadingPhase,
} from '../viewportLoading'

const run = (events: ViewportLoadingEvent[]): ViewportLoadingPhase =>
  events.reduce(nextViewportLoadingPhase, INITIAL_VIEWPORT_LOADING_PHASE)

describe('nextViewportLoadingPhase', () => {
  it('starts waiting for the first image', () => {
    expect(INITIAL_VIEWPORT_LOADING_PHASE).toBe('waiting')
    expect(isViewportLoading(INITIAL_VIEWPORT_LOADING_PHASE)).toBe(true)
  })

  it('moves to loading when the first tiles are requested', () => {
    expect(run(['started'])).toBe('loading')
  })

  it('becomes ready once the first batch ends', () => {
    expect(run(['started', 'ended'])).toBe('ready')
    expect(isViewportLoading('ready')).toBe(false)
  })

  it('becomes ready when loading fails so the indicator never sticks', () => {
    expect(run(['started', 'failed'])).toBe('ready')
    expect(run(['failed'])).toBe('ready')
  })

  it('stays ready while the user pans and zooms', () => {
    expect(run(['started', 'ended', 'started'])).toBe('ready')
  })

  it('waits again after a reset (new slide)', () => {
    expect(run(['started', 'ended', 'reset'])).toBe('waiting')
    expect(run(['started', 'ended', 'reset', 'started'])).toBe('loading')
  })
})
