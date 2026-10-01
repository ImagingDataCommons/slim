import { act, renderHook } from '@testing-library/react'

import { useLayerStyle } from '../useLayerStyle'

interface Style {
  opacity: number
  color: [number, number, number]
}

const INITIAL: Style = { opacity: 1, color: [255, 0, 0] }

describe('useLayerStyle', () => {
  it('previews changes locally without committing', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => useLayerStyle(INITIAL, onCommit))
    act(() => result.current[2]({ opacity: 0.4 }))
    expect(result.current[0]).toEqual({ opacity: 0.4, color: [255, 0, 0] })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('applies and commits only the changed part on update', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => useLayerStyle(INITIAL, onCommit))
    act(() => result.current[1]({ color: [0, 0, 255] }))
    expect(result.current[0]).toEqual({ opacity: 1, color: [0, 0, 255] })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith({ color: [0, 0, 255] })
  })

  it('follows the initial style when the reset key changes', () => {
    const { result, rerender } = renderHook(
      ({ style, resetKey }) => useLayerStyle(style, jest.fn(), resetKey),
      { initialProps: { style: INITIAL, resetKey: '1' } },
    )
    act(() => result.current[2]({ opacity: 0.2 }))
    rerender({ style: { opacity: 0.7, color: [0, 255, 0] }, resetKey: '2' })
    expect(result.current[0]).toEqual({ opacity: 0.7, color: [0, 255, 0] })
  })
})
