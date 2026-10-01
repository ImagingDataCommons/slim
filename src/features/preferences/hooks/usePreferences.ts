import { useSyncExternalStore } from 'react'

import { readStorage } from '../../../utils/safeStorage'
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_CHANGED_EVENT,
  PREFERENCES_STORAGE_KEY,
  parsePreferences,
  type UserPreferences,
} from '../utils/preferences'

let cachedRaw: string | null | undefined
let cachedPreferences: UserPreferences = DEFAULT_PREFERENCES

/**
 * `useSyncExternalStore` requires a referentially stable snapshot, so the
 * parsed value is reused until the stored string changes.
 */
function getSnapshot(): UserPreferences {
  const raw = readStorage(PREFERENCES_STORAGE_KEY)
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedPreferences = parsePreferences(raw)
  }
  return cachedPreferences
}

function getServerSnapshot(): UserPreferences {
  return DEFAULT_PREFERENCES
}

function subscribe(onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === PREFERENCES_STORAGE_KEY) {
      onChange()
    }
  }
  window.addEventListener(PREFERENCES_CHANGED_EVENT, onChange)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(PREFERENCES_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', handleStorage)
  }
}

/**
 * Current user preferences, re-rendering when they are saved in this tab or
 * changed in another tab.
 */
export function usePreferences(): UserPreferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
