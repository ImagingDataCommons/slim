import { act, renderHook } from '@testing-library/react'

import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('a', 300))
    expect(result.current).toBe('a')
  })

  it('updates only after the delay since the last change', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    )

    rerender({ value: 'ab' })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    rerender({ value: 'abc' })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current).toBe('a')

    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(result.current).toBe('abc')
  })
})
