import { fireEvent, renderHook } from '@testing-library/react'

import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  it('runs the shortcut of a released key with the latest handler', () => {
    const first = jest.fn()
    const latest = jest.fn()
    const { rerender } = renderHook(
      ({ onShortcut }) => useKeyboardShortcuts(onShortcut),
      { initialProps: { onShortcut: first } },
    )
    rerender({ onShortcut: latest })

    fireEvent.keyUp(document.body, { key: 'Escape', code: 'Escape' })

    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith('cancel')
  })

  it('ignores keys without a shortcut', () => {
    const onShortcut = jest.fn()
    renderHook(() => useKeyboardShortcuts(onShortcut))

    fireEvent.keyUp(document.body, { key: 'a', code: 'KeyA' })

    expect(onShortcut).not.toHaveBeenCalled()
  })

  it('tracks whether Shift is held', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(jest.fn()))

    fireEvent.keyDown(document.body, { key: 'Shift', code: 'ShiftLeft' })
    expect(result.current.isShiftDown()).toBe(true)

    fireEvent.keyUp(document.body, { key: 'Shift', code: 'ShiftLeft' })
    expect(result.current.isShiftDown()).toBe(false)
  })

  it('stops listening on unmount', () => {
    const onShortcut = jest.fn()
    const { unmount } = renderHook(() => useKeyboardShortcuts(onShortcut))

    unmount()
    fireEvent.keyUp(document.body, { key: 'Escape', code: 'Escape' })

    expect(onShortcut).not.toHaveBeenCalled()
  })
})
