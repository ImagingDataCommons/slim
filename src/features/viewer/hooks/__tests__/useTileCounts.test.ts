import { act, renderHook } from '@testing-library/react'

import { useTileCounts } from '../useTileCounts'

let frameCallbacks: FrameRequestCallback[] = []

function flushFrames(): void {
  const callbacks = frameCallbacks
  frameCallbacks = []
  act(() => {
    for (const callback of callbacks) callback(0)
  })
}

function publishFrame(
  kind: 'started' | 'ended' | 'error',
  sopInstanceUID: string,
  frameNumber: number,
): void {
  document.body.dispatchEvent(
    new CustomEvent(`dicommicroscopyviewer_frame_loading_${kind}`, {
      detail: { payload: { sopInstanceUID, frameNumber } },
    }),
  )
}

beforeEach(() => {
  frameCallbacks = []
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frameCallbacks.push(callback)
    return frameCallbacks.length
  })
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('useTileCounts', () => {
  it('batches frame events into one update per animation frame', () => {
    const { result } = renderHook(() => useTileCounts())
    publishFrame('started', 'a', 1)
    publishFrame('started', 'a', 2)
    publishFrame('ended', 'a', 1)
    expect(result.current).toEqual({ requested: 0, loaded: 0, failed: 0 })
    expect(frameCallbacks).toHaveLength(1)
    flushFrames()
    expect(result.current).toEqual({ requested: 2, loaded: 1, failed: 0 })
  })

  it('counts a failure that follows an ended event', () => {
    const { result } = renderHook(() => useTileCounts())
    publishFrame('started', 'a', 1)
    publishFrame('ended', 'a', 1)
    publishFrame('error', 'a', 1)
    flushFrames()
    expect(result.current).toEqual({ requested: 1, loaded: 0, failed: 1 })
  })

  it('ignores frames of other images', () => {
    const { result } = renderHook(() => useTileCounts(new Set(['volume'])))
    publishFrame('started', 'label', 1)
    publishFrame('started', 'volume', 1)
    flushFrames()
    expect(result.current.requested).toBe(1)
  })

  it('follows changes of the allowed images without resetting', () => {
    const { result, rerender } = renderHook(({ uids }) => useTileCounts(uids), {
      initialProps: { uids: new Set(['a']) },
    })
    publishFrame('started', 'a', 1)
    flushFrames()
    rerender({ uids: new Set(['b']) })
    publishFrame('started', 'a', 2)
    publishFrame('started', 'b', 1)
    flushFrames()
    expect(result.current.requested).toBe(2)
  })

  it('restarts counting when the reset key changes', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useTileCounts(undefined, resetKey),
      { initialProps: { resetKey: 'viewer-1' } },
    )
    publishFrame('started', 'a', 1)
    flushFrames()
    expect(result.current.requested).toBe(1)
    rerender({ resetKey: 'viewer-2' })
    expect(result.current).toEqual({ requested: 0, loaded: 0, failed: 0 })
    publishFrame('started', 'a', 1)
    flushFrames()
    expect(result.current.requested).toBe(1)
  })

  it('removes listeners and cancels the pending frame on unmount', () => {
    const removeSpy = jest.spyOn(document.body, 'removeEventListener')
    const { unmount } = renderHook(() => useTileCounts())
    publishFrame('started', 'a', 1)
    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1)
    expect(removeSpy).toHaveBeenCalledTimes(3)
  })
})
