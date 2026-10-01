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
let isDirty = true
let subscriberCount = 0

/**
 * `useSyncExternalStore` calls this on every render of every consumer and
 * requires a referentially stable result. Storage is re-read only after a
 * change event marked the cache dirty, or while nothing is subscribed (no
 * events are being received then); the parsed value is reused until the
 * stored string changes.
 */
function getSnapshot(): UserPreferences {
  if (!isDirty && subscriberCount > 0) return cachedPreferences
  isDirty = false
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
  const handleChange = (): void => {
    isDirty = true
    onChange()
  }
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === PREFERENCES_STORAGE_KEY) {
      handleChange()
    }
  }
  subscriberCount += 1
  isDirty = true
  window.addEventListener(PREFERENCES_CHANGED_EVENT, handleChange)
  window.addEventListener('storage', handleStorage)
  return () => {
    subscriberCount -= 1
    window.removeEventListener(PREFERENCES_CHANGED_EVENT, handleChange)
    window.removeEventListener('storage', handleStorage)
  }
}

/**
 * Current user preferences, re-rendering when they are saved in this tab
 * (through `savePreferences`) or changed in another tab.
 */
export function usePreferences(): UserPreferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
