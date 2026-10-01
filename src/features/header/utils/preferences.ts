/** User preferences persisted in localStorage by the Preferences dialog. */

import { readStorage, writeStorage } from '../../../utils/safeStorage'

export type MeasurementUnit = 'µm' | 'mm'

export interface UserPreferences {
  units: MeasurementUnit
  compactRows: boolean
  rememberFilters: boolean
  strokeColor: string
  strokeWidth: number
  showRoiLabels: boolean
  confirmRoiRemoval: boolean
}

export const PREFERENCES_STORAGE_KEY = 'slim-preferences'

/** Window event fired after {@link savePreferences} writes new values. */
export const PREFERENCES_CHANGED_EVENT = 'slim-preferences-changed'

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export const STROKE_COLORS = [
  '#1f5ad1',
  '#d9453b',
  '#d98a1f',
  '#1f9d6b',
  '#7a4bd1',
  '#0f1a2a',
]

export const DEFAULT_PREFERENCES: UserPreferences = {
  units: 'µm',
  compactRows: false,
  rememberFilters: true,
  strokeColor: STROKE_COLORS[0],
  strokeWidth: 2,
  showRoiLabels: true,
  confirmRoiRemoval: true,
}

/** Merge stored JSON over defaults, ignoring unknown or mistyped fields. */
export function parsePreferences(stored: string | null): UserPreferences {
  if (stored === null || stored === '') return { ...DEFAULT_PREFERENCES }
  try {
    const parsed = JSON.parse(stored) as Partial<
      Record<keyof UserPreferences, unknown>
    >
    const result: UserPreferences = { ...DEFAULT_PREFERENCES }
    if (parsed.units === 'µm' || parsed.units === 'mm')
      result.units = parsed.units
    if (typeof parsed.compactRows === 'boolean')
      result.compactRows = parsed.compactRows
    if (typeof parsed.rememberFilters === 'boolean') {
      result.rememberFilters = parsed.rememberFilters
    }
    if (
      typeof parsed.strokeColor === 'string' &&
      HEX_COLOR_PATTERN.test(parsed.strokeColor)
    ) {
      result.strokeColor = parsed.strokeColor
    }
    if (
      typeof parsed.strokeWidth === 'number' &&
      Number.isFinite(parsed.strokeWidth) &&
      parsed.strokeWidth >= 1 &&
      parsed.strokeWidth <= 6
    ) {
      result.strokeWidth = parsed.strokeWidth
    }
    if (typeof parsed.showRoiLabels === 'boolean') {
      result.showRoiLabels = parsed.showRoiLabels
    }
    if (typeof parsed.confirmRoiRemoval === 'boolean') {
      result.confirmRoiRemoval = parsed.confirmRoiRemoval
    }
    return result
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function loadPreferences(): UserPreferences {
  return parsePreferences(readStorage(PREFERENCES_STORAGE_KEY))
}

export function savePreferences(preferences: UserPreferences): void {
  writeStorage(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT))
}
