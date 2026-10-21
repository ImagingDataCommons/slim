import { fireEvent, renderHook } from '@testing-library/react'

import { useHeldKeys, useKeyboardShortcuts } from '../useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  it('runs the shortcut of a released key with the latest handler', () => {
    const first = vi.fn()
    const latest = vi.fn()
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
    const onShortcut = vi.fn()
    renderHook(() => useKeyboardShortcuts(onShortcut))

    fireEvent.keyUp(document.body, { key: 'a', code: 'KeyA' })

    expect(onShortcut).not.toHaveBeenCalled()
  })

  it('stops listening on unmount', () => {
    const onShortcut = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcuts(onShortcut))

    unmount()
    fireEvent.keyUp(document.body, { key: 'Escape', code: 'Escape' })

    expect(onShortcut).not.toHaveBeenCalled()
  })
})

describe('useKeyboardShortcuts with a dialog open', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  function openDialog(): HTMLElement {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    const button = document.createElement('button')
    dialog.append(button)
    document.body.append(dialog)
    return button
  }

  it('lets Escape answer the dialog without cancelling the tool', () => {
    const onShortcut = vi.fn()
    renderHook(() => useKeyboardShortcuts(onShortcut))
    const insideDialog = openDialog()

    fireEvent.keyDown(insideDialog, { key: 'Escape', code: 'Escape' })
    /** The dialog closed on key-down, so key-up lands outside it */
    document.body.replaceChildren()
    fireEvent.keyUp(document.body, { key: 'Escape', code: 'Escape' })
    expect(onShortcut).not.toHaveBeenCalled()

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })
    fireEvent.keyUp(document.body, { key: 'Escape', code: 'Escape' })
    expect(onShortcut).toHaveBeenCalledWith('cancel')
  })

  it('ignores Alt shortcuts while a modal is open', () => {
    const onShortcut = vi.fn()
    renderHook(() => useKeyboardShortcuts(onShortcut))
    openDialog()

    fireEvent.keyUp(document.body, { key: 'd', code: 'KeyD', altKey: true })
    expect(onShortcut).not.toHaveBeenCalled()

    document.body.replaceChildren()
    fireEvent.keyUp(document.body, { key: 'd', code: 'KeyD', altKey: true })
    expect(onShortcut).toHaveBeenCalledTimes(1)
  })
})

describe('useHeldKeys', () => {
  it('tracks whether Shift is held', () => {
    const { result } = renderHook(() => useHeldKeys())

    fireEvent.keyDown(document.body, { key: 'Shift', code: 'ShiftLeft' })
    expect(result.current.isShiftDown()).toBe(true)

    fireEvent.keyUp(document.body, { key: 'Shift', code: 'ShiftLeft' })
    expect(result.current.isShiftDown()).toBe(false)
  })

  it('stops tracking on unmount', () => {
    const { result, unmount } = renderHook(() => useHeldKeys())

    unmount()
    fireEvent.keyDown(document.body, { key: 'Shift', code: 'ShiftLeft' })

    expect(result.current.isShiftDown()).toBe(false)
  })
})
