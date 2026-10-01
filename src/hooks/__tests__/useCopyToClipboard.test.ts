import { act, renderHook } from '@testing-library/react'

import { useCopyToClipboard } from '../useCopyToClipboard'

function mockClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
}

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('marks the text as copied until the timeout elapses', async () => {
    const writeText = jest.fn(async () => undefined)
    mockClipboard(writeText)
    const { result } = renderHook(() => useCopyToClipboard(1000))

    let succeeded = false
    await act(async () => {
      succeeded = await result.current.copy('hello')
    })

    expect(succeeded).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(result.current.copied).toBe(true)

    act(() => {
      jest.advanceTimersByTime(999)
    })
    expect(result.current.copied).toBe(true)
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current.copied).toBe(false)
  })

  it('restarts the timeout on a second copy', async () => {
    mockClipboard(async () => undefined)
    const { result } = renderHook(() => useCopyToClipboard(1000))

    await act(async () => {
      await result.current.copy('first')
    })
    act(() => {
      jest.advanceTimersByTime(800)
    })
    await act(async () => {
      await result.current.copy('second')
    })
    act(() => {
      jest.advanceTimersByTime(800)
    })
    expect(result.current.copied).toBe(true)
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current.copied).toBe(false)
  })

  it('reports failure when the clipboard rejects', async () => {
    mockClipboard(async () => {
      throw new Error('denied')
    })
    const { result } = renderHook(() => useCopyToClipboard())

    let succeeded = true
    await act(async () => {
      succeeded = await result.current.copy('text')
    })

    expect(succeeded).toBe(false)
    expect(result.current.copied).toBe(false)
  })

  it('reports failure without a clipboard (insecure context)', async () => {
    Reflect.deleteProperty(navigator, 'clipboard')
    const { result } = renderHook(() => useCopyToClipboard())

    let succeeded = true
    await act(async () => {
      succeeded = await result.current.copy('text')
    })

    expect(succeeded).toBe(false)
  })

  it('clears the pending timeout on unmount', async () => {
    mockClipboard(async () => undefined)
    const clearSpy = jest.spyOn(global, 'clearTimeout')
    const { result, unmount } = renderHook(() => useCopyToClipboard(1000))
    await act(async () => {
      await result.current.copy('text')
    })
    clearSpy.mockClear()

    unmount()

    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
    clearSpy.mockRestore()
  })
})
