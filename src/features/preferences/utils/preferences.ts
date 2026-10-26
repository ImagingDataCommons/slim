/** User preferences persisted in localStorage by the Preferences dialog. */

import { readStorage, writeStorage } from '../../../utils/safeStorage'
import { sanitizeHiddenColumnIds } from '../../worklist/utils/worklistColumns'

export type MeasurementUnit = 'µm' | 'mm'

export interface UserPreferences {
  /** Preferred length unit for DMV markup labels and Slim measurement displays */
  units: MeasurementUnit
  compactRows: boolean
  /**
   * New ROIs of a finding with a configured style (config.annotations[].style)
   * use that finding's color; off draws every new ROI with
   * {@link UserPreferences.strokeColor}
   */
  useFindingColors: boolean
  /** Stroke color for new ROIs you draw */
  strokeColor: string
  /**
   * Color for on-slide measurement-value labels and the dotted link line to
   * the ROI. Independent of stroke color.
   */
  markupLabelColor: string
  /** Font size (px) for on-slide measurement-value labels */
  markupLabelFontSize: number
  /** Stroke width for every new ROI you draw */
  strokeWidth: number
  /** Fill the interior of new ROIs (polygons / circles) */
  roiFill: boolean
  /** Fill opacity for new ROIs when {@link UserPreferences.roiFill} is on */
  roiFillOpacity: number
  confirmRoiRemoval: boolean
  /** Slide thumbnail in the bottom-right corner of the viewport */
  showOverviewMap: boolean
  /** Scale bar, magnification and cursor position in the bottom-left corner */
  showViewportInfo: boolean
  /** Active slide name in the top-left corner */
  showSlideLabel: boolean
  /** Zoom in, zoom out and fit buttons in the top-right corner */
  showZoomControls: boolean
  /**
   * Worklist column ids the user turned off. Width-based shedding still
   * decides the maximum set; these only hide extras within that set.
   */
  worklistHiddenColumnIds: string[]
}

type BooleanPreference = {
  [K in keyof UserPreferences]: UserPreferences[K] extends boolean ? K : never
}[keyof UserPreferences]

const BOOLEAN_PREFERENCES: readonly BooleanPreference[] = [
  'compactRows',
  'useFindingColors',
  'roiFill',
  'confirmRoiRemoval',
  'showOverviewMap',
  'showViewportInfo',
  'showSlideLabel',
  'showZoomControls',
]

export const PREFERENCES_STORAGE_KEY = 'slim-preferences'

/** Window event fired after {@link savePreferences} writes new values. */
export const PREFERENCES_CHANGED_EVENT = 'slim-preferences-changed'

/**
 * Live preview of annotation prefs (label color / size / units) while the
 * Preferences dialog is open, before Save. The slide viewer applies these
 * immediately.
 */
export const ANNOTATION_PREFS_PREVIEW_EVENT = 'slim-annotation-prefs-preview'

export type AnnotationPrefsPreview = Pick<
  UserPreferences,
  'markupLabelColor' | 'markupLabelFontSize' | 'units'
>

/** Notify open viewers to apply label prefs without persisting yet. */
export function previewAnnotationPreferences(
  preview: AnnotationPrefsPreview,
): void {
  window.dispatchEvent(
    new CustomEvent<AnnotationPrefsPreview>(ANNOTATION_PREFS_PREVIEW_EVENT, {
      detail: preview,
    }),
  )
}

/**
 * Live preview of draw-style prefs (stroke / fill) while Preferences is open.
 * Applied to the in-progress draw interaction without waiting for Save.
 */
export const DRAW_STYLE_PREFS_PREVIEW_EVENT = 'slim-draw-style-prefs-preview'

export type DrawStylePrefsPreview = Pick<
  UserPreferences,
  'strokeColor' | 'strokeWidth' | 'roiFill' | 'roiFillOpacity'
>

/** Notify open viewers to apply stroke / fill prefs without persisting yet. */
export function previewDrawStylePreferences(
  preview: DrawStylePrefsPreview,
): void {
  window.dispatchEvent(
    new CustomEvent<DrawStylePrefsPreview>(DRAW_STYLE_PREFS_PREVIEW_EVENT, {
      detail: preview,
    }),
  )
}

/** Allowed range for {@link UserPreferences.markupLabelFontSize} */
export const MARKUP_LABEL_FONT_SIZE_MIN = 10
export const MARKUP_LABEL_FONT_SIZE_MAX = 24
export const MARKUP_LABEL_FONT_SIZE_DEFAULT = 13

/** Allowed range for {@link UserPreferences.roiFillOpacity} */
export const ROI_FILL_OPACITY_MIN = 0.05
export const ROI_FILL_OPACITY_MAX = 1
export const ROI_FILL_OPACITY_DEFAULT = 0.35

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
  useFindingColors: true,
  strokeColor: STROKE_COLORS[0],
  markupLabelColor: STROKE_COLORS[0],
  markupLabelFontSize: MARKUP_LABEL_FONT_SIZE_DEFAULT,
  strokeWidth: 2,
  roiFill: true,
  roiFillOpacity: ROI_FILL_OPACITY_DEFAULT,
  confirmRoiRemoval: true,
  showOverviewMap: true,
  showViewportInfo: true,
  showSlideLabel: true,
  showZoomControls: true,
  worklistHiddenColumnIds: [],
}

/**
 * Preferences owned by Preferences → Annotations. Reset restores these only;
 * General / worklist settings are left alone.
 */
export const ANNOTATION_PREFERENCE_KEYS = [
  'units',
  'useFindingColors',
  'strokeColor',
  'markupLabelColor',
  'markupLabelFontSize',
  'strokeWidth',
  'roiFill',
  'roiFillOpacity',
  'confirmRoiRemoval',
] as const satisfies ReadonlyArray<keyof UserPreferences>

export type AnnotationPreferenceKey =
  (typeof ANNOTATION_PREFERENCE_KEYS)[number]

export type AnnotationPreferences = Pick<
  UserPreferences,
  AnnotationPreferenceKey
>

/** Factory defaults for the Annotations tab. */
export function defaultAnnotationPreferences(): AnnotationPreferences {
  const defaults = {} as AnnotationPreferences
  for (const key of ANNOTATION_PREFERENCE_KEYS) {
    defaults[key] = DEFAULT_PREFERENCES[key] as never
  }
  return defaults
}

/**
 * Replace annotation fields on a preferences object with factory defaults.
 * Other fields are unchanged.
 */
export function withAnnotationDefaults(
  preferences: UserPreferences,
): UserPreferences {
  return {
    ...preferences,
    ...defaultAnnotationPreferences(),
  }
}

function cloneDefaults(): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    worklistHiddenColumnIds: [...DEFAULT_PREFERENCES.worklistHiddenColumnIds],
  }
}

/** Merge stored JSON over defaults, ignoring unknown or mistyped fields. */
export function parsePreferences(stored: string | null): UserPreferences {
  if (stored === null || stored === '') return cloneDefaults()
  try {
    const parsed = JSON.parse(stored) as Partial<
      Record<keyof UserPreferences, unknown>
    >
    const result: UserPreferences = cloneDefaults()
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
      typeof parsed.markupLabelColor === 'string' &&
      HEX_COLOR_PATTERN.test(parsed.markupLabelColor)
    ) {
      result.markupLabelColor = parsed.markupLabelColor
    }
    if (
      typeof parsed.markupLabelFontSize === 'number' &&
      Number.isFinite(parsed.markupLabelFontSize) &&
      parsed.markupLabelFontSize >= MARKUP_LABEL_FONT_SIZE_MIN &&
      parsed.markupLabelFontSize <= MARKUP_LABEL_FONT_SIZE_MAX
    ) {
      result.markupLabelFontSize = Math.round(parsed.markupLabelFontSize)
    }
    if (
      typeof parsed.strokeWidth === 'number' &&
      Number.isFinite(parsed.strokeWidth) &&
      parsed.strokeWidth >= 1 &&
      parsed.strokeWidth <= 6
    ) {
      result.strokeWidth = parsed.strokeWidth
    }
    if (
      typeof parsed.roiFillOpacity === 'number' &&
      Number.isFinite(parsed.roiFillOpacity) &&
      parsed.roiFillOpacity >= ROI_FILL_OPACITY_MIN &&
      parsed.roiFillOpacity <= ROI_FILL_OPACITY_MAX
    ) {
      result.roiFillOpacity = parsed.roiFillOpacity
    }
    if (Array.isArray(parsed.worklistHiddenColumnIds)) {
      result.worklistHiddenColumnIds = sanitizeHiddenColumnIds(
        parsed.worklistHiddenColumnIds,
      )
    }
    return result
  } catch {
    return cloneDefaults()
  }
}

export function loadPreferences(): UserPreferences {
  return parsePreferences(readStorage(PREFERENCES_STORAGE_KEY))
}

export function savePreferences(preferences: UserPreferences): void {
  writeStorage(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT))
}
