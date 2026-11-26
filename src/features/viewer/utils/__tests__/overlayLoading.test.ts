import {
  INITIAL_OVERLAY_LOADING,
  type OverlayLoadingAction,
  overlayLoadingReducer,
  overlayStatus,
} from '../overlayLoading'

const run = (actions: OverlayLoadingAction[]) =>
  actions.reduce(overlayLoadingReducer, INITIAL_OVERLAY_LOADING)

describe('overlayLoadingReducer', () => {
  it('counts the frames of a burst until all have settled', () => {
    const state = run([
      { type: 'started', key: 'a', kind: 'segments' },
      { type: 'started', key: 'b', kind: 'segments' },
      { type: 'started', key: 'c', kind: 'segments' },
      { type: 'settled', key: 'a' },
    ])
    expect(overlayStatus(state)).toEqual({
      label: 'Loading segments',
      progress: '1 of 3 frames',
    })
    const done = run([
      { type: 'started', key: 'a', kind: 'segments' },
      { type: 'settled', key: 'a' },
    ])
    expect(done).toBe(INITIAL_OVERLAY_LOADING)
    expect(overlayStatus(done)).toBeUndefined()
  })

  it('keeps its state for repeated or unknown events', () => {
    const state = run([{ type: 'started', key: 'a', kind: 'maps' }])
    expect(
      overlayLoadingReducer(state, {
        type: 'started',
        key: 'a',
        kind: 'maps',
      }),
    ).toBe(state)
    expect(overlayLoadingReducer(state, { type: 'settled', key: 'z' })).toBe(
      state,
    )
    expect(
      overlayLoadingReducer(INITIAL_OVERLAY_LOADING, { type: 'reset' }),
    ).toBe(INITIAL_OVERLAY_LOADING)
  })

  it('shows no frame count for a single frame or for annotations', () => {
    expect(
      overlayStatus(run([{ type: 'started', key: 'a', kind: 'maps' }])),
    ).toEqual({ label: 'Loading parametric maps', progress: undefined })
    expect(
      overlayStatus(
        run([
          { type: 'started', key: 'x', kind: 'annotations' },
          { type: 'started', key: 'y', kind: 'annotations' },
        ]),
      ),
    ).toEqual({ label: 'Loading annotations', progress: undefined })
  })
})
