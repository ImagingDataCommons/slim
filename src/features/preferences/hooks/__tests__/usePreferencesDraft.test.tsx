import { act, renderHook } from '@testing-library/react'
import type * as React from 'react'

import { ThemeProvider } from '../../../../contexts/ThemeContext'
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
} from '../../utils/preferences'
import type { PreferencesTab } from '../../utils/preferencesTabs'
import { usePreferencesDraft } from '../usePreferencesDraft'

function wrapper({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return <ThemeProvider>{children}</ThemeProvider>
}

interface Props {
  open: boolean
  initialTab: PreferencesTab
}

function renderDraft(initialProps: Props) {
  return renderHook(
    ({ open, initialTab }: Props) => usePreferencesDraft(open, initialTab),
    { wrapper, initialProps },
  )
}

describe('usePreferencesDraft', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps edits while the dialog stays open', () => {
    const { result, rerender } = renderDraft({
      open: true,
      initialTab: 'general',
    })
    act(() => {
      result.current.update('compactRows', true)
    })
    rerender({ open: true, initialTab: 'general' })
    expect(result.current.draft.compactRows).toBe(true)
    expect(loadPreferences().compactRows).toBe(false)
  })

  it('discards unsaved edits and resets the tab when reopened', () => {
    const { result, rerender } = renderDraft({
      open: true,
      initialTab: 'general',
    })
    act(() => {
      result.current.update('strokeWidth', 5)
      result.current.setActiveTab('keys')
    })
    rerender({ open: false, initialTab: 'about' })
    rerender({ open: true, initialTab: 'about' })
    expect(result.current.draft.strokeWidth).toBe(
      DEFAULT_PREFERENCES.strokeWidth,
    )
    expect(result.current.activeTab).toBe('about')
  })

  it('reloads preferences saved elsewhere when reopened', () => {
    const { result, rerender } = renderDraft({
      open: false,
      initialTab: 'general',
    })
    savePreferences({ ...DEFAULT_PREFERENCES, units: 'mm' })
    rerender({ open: true, initialTab: 'general' })
    expect(result.current.draft.units).toBe('mm')
  })

  it('saves the draft and the theme', () => {
    const { result } = renderDraft({ open: true, initialTab: 'general' })
    act(() => {
      result.current.update('confirmRoiRemoval', false)
      result.current.setDraftTheme('dark')
    })
    act(() => {
      result.current.save()
    })
    expect(loadPreferences().confirmRoiRemoval).toBe(false)
    expect(window.localStorage.getItem('slim-theme')).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
  })
})
