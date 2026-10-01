/** User preferences persisted in localStorage by the Preferences dialog. */

import { readStorage, writeStorage } from '../../../utils/safeStorage'

export type MeasurementUnit = 'µm' | 'mm'

export interface UserPreferences {
  units: MeasurementUnit
  compactRows: boolean
  strokeColor: string
  strokeWidth: number
  confirmRoiRemoval: boolean
  /** Slide thumbnail in the bottom-right corner of the viewport */
  showOverviewMap: boolean
  /** Scale bar, magnification and cursor position in the bottom-left corner */
  showViewportInfo: boolean
  /** Active slide name in the top-left corner */
  showSlideLabel: boolean
  /** Zoom in, zoom out and fit buttons in the top-right corner */
  showZoomControls: boolean
}

type BooleanPreference = {
  [K in keyof UserPreferences]: UserPreferences[K] extends boolean ? K : never
}[keyof UserPreferences]

const BOOLEAN_PREFERENCES: readonly BooleanPreference[] = [
  'compactRows',
  'confirmRoiRemoval',
  'showOverviewMap',
  'showViewportInfo',
  'showSlideLabel',
  'showZoomControls',
]

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
  strokeColor: STROKE_COLORS[0],
  strokeWidth: 2,
  confirmRoiRemoval: true,
  showOverviewMap: true,
  showViewportInfo: true,
  showSlideLabel: true,
  showZoomControls: true,
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
    for (const key of BOOLEAN_PREFERENCES) {
      const value = parsed[key]
      if (typeof value === 'boolean') result[key] = value
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
