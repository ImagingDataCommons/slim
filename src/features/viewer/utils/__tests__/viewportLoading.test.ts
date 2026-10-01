import {
  INITIAL_VIEWPORT_LOADING,
  INITIAL_VIEWPORT_LOADING_PHASE,
  isViewportLoading,
  nextViewportLoadingPhase,
  type ViewportLoadingAction,
  type ViewportLoadingEvent,
  type ViewportLoadingPhase,
  viewportLoadingReducer,
} from '../viewportLoading'

describe('viewportLoadingReducer', () => {
  const reduce = (actions: ViewportLoadingAction[]) =>
    actions.reduce(viewportLoadingReducer, INITIAL_VIEWPORT_LOADING)

  it('tracks the busy flag and the first-image phase together', () => {
    expect(reduce([{ type: 'loadingStarted' }])).toEqual({
      isLoading: true,
      phase: 'loading',
    })
    expect(
      reduce([{ type: 'loadingStarted' }, { type: 'loadingEnded' }]),
    ).toEqual({ isLoading: false, phase: 'ready' })
  })

  it('keeps the busy flag when loading fails', () => {
    expect(
      reduce([{ type: 'loadingStarted' }, { type: 'loadingFailed' }]),
    ).toEqual({ isLoading: true, phase: 'ready' })
  })

  it('ends loading once the last pending frame settles', () => {
    const started = reduce([{ type: 'loadingStarted' }])
    expect(
      viewportLoadingReducer(started, {
        type: 'frameSettled',
        hasPendingFrames: true,
      }),
    ).toEqual({ isLoading: true, phase: 'loading' })
    expect(
      viewportLoadingReducer(started, {
        type: 'frameSettled',
        hasPendingFrames: false,
      }),
    ).toEqual({ isLoading: false, phase: 'ready' })
  })

  it('waits again after a reset', () => {
    expect(
      reduce([
        { type: 'loadingStarted' },
        { type: 'loadingEnded' },
        { type: 'reset' },
      ]),
    ).toEqual(INITIAL_VIEWPORT_LOADING)
  })

  it('returns the same state when nothing changes', () => {
    expect(
      viewportLoadingReducer(INITIAL_VIEWPORT_LOADING, { type: 'reset' }),
    ).toBe(INITIAL_VIEWPORT_LOADING)
  })
})

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
