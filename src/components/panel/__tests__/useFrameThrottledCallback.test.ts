import { act, renderHook } from '@testing-library/react'

import { useFrameThrottledCallback } from '../useFrameThrottledCallback'

describe('useFrameThrottledCallback', () => {
  let frames: Map<number, FrameRequestCallback>
  let nextFrame: number

  const flushFrame = (): void => {
    const pending = [...frames.values()]
    frames.clear()
    for (const run of pending) run(0)
  }

  beforeEach(() => {
    frames = new Map()
    nextFrame = 1
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (run: FrameRequestCallback): number => {
        const id = nextFrame++
        frames.set(id, run)
        return id
      },
    )
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(
      (id: number): void => {
        frames.delete(id)
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the callback once per frame with the latest arguments', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useFrameThrottledCallback(callback))

    act(() => {
      result.current(1)
      result.current(2)
      result.current(3)
    })
    expect(callback).not.toHaveBeenCalled()

    act(flushFrame)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(3)

    act(() => {
      result.current(4)
    })
    act(flushFrame)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith(4)
  })

  it('uses the latest callback without rescheduling', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(
      ({ callback }) => useFrameThrottledCallback(callback),
      { initialProps: { callback: first } },
    )
    act(() => {
      result.current('a')
    })
    rerender({ callback: second })
    act(flushFrame)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('a')
  })

  it('drops a pending call on unmount', () => {
    const callback = vi.fn()
    const { result, unmount } = renderHook(() =>
      useFrameThrottledCallback(callback),
    )
    act(() => {
      result.current(1)
    })
    unmount()
    act(flushFrame)
    expect(callback).not.toHaveBeenCalled()
  })
})
