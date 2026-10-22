import { act, renderHook } from '@testing-library/react'

import { useResettableState } from '../useResettableState'

describe('useResettableState', () => {
  it('keeps local updates while the reset key is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ initial, resetKey }) => useResettableState(initial, resetKey),
      { initialProps: { initial: 1, resetKey: 'a' } },
    )
    act(() => result.current[1]((previous) => previous + 1))
    expect(result.current[0]).toBe(2)

    rerender({ initial: 5, resetKey: 'a' })
    expect(result.current[0]).toBe(2)
  })

  it('restarts from the initial value when the reset key changes', () => {
    const { result, rerender } = renderHook(
      ({ initial, resetKey }) => useResettableState(initial, resetKey),
      { initialProps: { initial: 1, resetKey: 'a' } },
    )
    act(() => result.current[1](() => 10))

    rerender({ initial: 5, resetKey: 'b' })
    expect(result.current[0]).toBe(5)

    act(() => result.current[1]((previous) => previous * 2))
    expect(result.current[0]).toBe(10)
  })

  it('never resets without a reset key', () => {
    const { result, rerender } = renderHook(
      ({ initial }) => useResettableState(initial),
      { initialProps: { initial: 'x' } },
    )
    act(() => result.current[1](() => 'y'))
    rerender({ initial: 'z' })
    expect(result.current[0]).toBe('y')
  })
})
