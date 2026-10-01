import { useCallback, useState } from 'react'

import { type Theme, useTheme } from '../../../contexts/ThemeContext'
import {
  loadPreferences,
  savePreferences,
  type UserPreferences,
} from '../utils/preferences'

export type PreferencesTab =
  | 'general'
  | 'annotations'
  | 'keys'
  | 'config'
  | 'about'

interface UsePreferencesDraftReturn {
  activeTab: PreferencesTab
  setActiveTab: (tab: PreferencesTab) => void
  draftTheme: Theme
  setDraftTheme: (theme: Theme) => void
  draft: UserPreferences
  update: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void
  /** Persist the draft preferences and theme */
  save: () => void
}

/**
 * Unsaved Preferences dialog state. The draft is reset from storage only
 * when the dialog transitions to open, so theme changes or re-renders while
 * it is open keep in-progress edits.
 */
export function usePreferencesDraft(
  open: boolean,
  initialTab: PreferencesTab,
): UsePreferencesDraftReturn {
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<PreferencesTab>(initialTab)
  const [draftTheme, setDraftTheme] = useState<Theme>(theme)
  const [draft, setDraft] = useState<UserPreferences>(loadPreferences)
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setActiveTab(initialTab)
      setDraftTheme(theme)
      setDraft(loadPreferences())
    }
  }

  const update = useCallback(
    <K extends keyof UserPreferences>(
      key: K,
      value: UserPreferences[K],
    ): void => {
      setDraft((previous) => ({ ...previous, [key]: value }))
    },
    [],
  )

  const save = useCallback((): void => {
    savePreferences(draft)
    setTheme(draftTheme)
  }, [draft, draftTheme, setTheme])

  return {
    activeTab,
    setActiveTab,
    draftTheme,
    setDraftTheme,
    draft,
    update,
    save,
  }
}
