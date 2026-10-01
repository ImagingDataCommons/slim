import { act, renderHook } from '@testing-library/react'

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  savePreferences,
} from '../../utils/preferences'
import { usePreferences } from '../usePreferences'

describe('usePreferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns the defaults when nothing is stored', () => {
    const { result } = renderHook(() => usePreferences())
    expect(result.current).toEqual(DEFAULT_PREFERENCES)
  })

  it('reads the stored preferences on mount', () => {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ units: 'mm' }),
    )
    const { result } = renderHook(() => usePreferences())
    expect(result.current.units).toBe('mm')
  })

  it('does not read storage again on re-render', () => {
    const { result, rerender } = renderHook(() => usePreferences())
    const first = result.current
    const getItem = jest.spyOn(Storage.prototype, 'getItem')
    rerender()
    rerender()
    expect(getItem).not.toHaveBeenCalled()
    expect(result.current).toBe(first)
  })

  it('updates after savePreferences in this tab', () => {
    const { result } = renderHook(() => usePreferences())
    act(() => {
      savePreferences({ ...DEFAULT_PREFERENCES, strokeWidth: 4 })
    })
    expect(result.current.strokeWidth).toBe(4)
  })

  it('keeps the same object when the stored value is unchanged', () => {
    const { result } = renderHook(() => usePreferences())
    const first = result.current
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    expect(result.current).toBe(first)
  })

  it('updates after a change in another tab', () => {
    const { result } = renderHook(() => usePreferences())
    act(() => {
      window.localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify({ compactRows: true }),
      )
      window.dispatchEvent(
        new StorageEvent('storage', { key: PREFERENCES_STORAGE_KEY }),
      )
    })
    expect(result.current.compactRows).toBe(true)
  })

  it('ignores storage events for other keys', () => {
    const { result } = renderHook(() => usePreferences())
    act(() => {
      window.localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify({ compactRows: true }),
      )
      window.dispatchEvent(new StorageEvent('storage', { key: 'other' }))
    })
    expect(result.current.compactRows).toBe(false)
  })

  it('picks up changes made while unmounted', () => {
    const first = renderHook(() => usePreferences())
    first.unmount()
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ units: 'mm' }),
    )
    const { result } = renderHook(() => usePreferences())
    expect(result.current.units).toBe('mm')
  })
})
