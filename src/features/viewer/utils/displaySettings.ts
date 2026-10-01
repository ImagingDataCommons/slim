/** Pure helpers for the viewer's display-settings panels. */

export const MIN_CLUSTERING_THRESHOLD_MM = 0
export const MAX_CLUSTERING_THRESHOLD_MM = 100

/** DMV's threshold when constructed without one (automatic mode). */
export const DMV_DEFAULT_CLUSTERING_THRESHOLD_MM = 0.001

export interface ParsedClusteringThreshold {
  /** Threshold in mm; `null` means automatic (zoom-based) detection */
  value: number | null
  isValid: boolean
}

/**
 * Parse the raw clustering pixel size threshold field. Empty input means
 * automatic detection; values above the maximum are clamped; negatives and
 * non-numeric text are rejected so partial input such as "0." stays editable
 * without being applied.
 */
export function parseClusteringThreshold(
  raw: string,
): ParsedClusteringThreshold {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: null, isValid: true }
  if (!/^\d*\.?\d+$/.test(trimmed)) return { value: null, isValid: false }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < MIN_CLUSTERING_THRESHOLD_MM) {
    return { value: null, isValid: false }
  }
  return {
    value: Math.min(parsed, MAX_CLUSTERING_THRESHOLD_MM),
    isValid: true,
  }
}

/**
 * Threshold DMV should use: `undefined` disables clustering, otherwise the
 * parsed value or `fallback` when the field is empty or invalid.
 */
export function resolveClusteringThreshold(
  isEnabled: boolean,
  raw: string,
  fallback?: number,
): number | undefined {
  if (!isEnabled) return undefined
  const { value, isValid } = parseClusteringThreshold(raw)
  if (!isValid || value === null) return fallback
  return value
}

/** Keys whose values differ between two flat settings objects. */
export function changedSettingKeys<T extends object>(
  previous: T,
  next: T,
): Array<keyof T> {
  const keys = new Set<keyof T>([
    ...(Object.keys(previous) as Array<keyof T>),
    ...(Object.keys(next) as Array<keyof T>),
  ])
  return Array.from(keys).filter((key) => previous[key] !== next[key])
}
