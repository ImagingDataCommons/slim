export interface OpticalPathDefaultsSource {
  identifier: string
  isMonochromatic: boolean
  paletteColorLookupTableUID?: string | null
}

/** Colors given to monochrome paths shown when nothing else would be */
export const DEFAULT_OPTICAL_PATH_COLORS: readonly number[][] = [
  [255, 255, 255],
]

export interface DefaultOpticalPathPlan {
  /** Identifiers to show, in input order */
  visibleIdentifiers: string[]
  /** Monochrome paths that need a default color to be shown */
  colorAssignments: Array<{ identifier: string; color: number[] }>
}

/**
 * Viewer default display: color paths and monochrome paths with a palette
 * are shown. When that selects nothing, the first monochrome paths are shown
 * with the default colors instead.
 */
export function planDefaultOpticalPaths(
  opticalPaths: readonly OpticalPathDefaultsSource[],
): DefaultOpticalPathPlan {
  const visibleIdentifiers = opticalPaths
    .filter(
      (item) =>
        !item.isMonochromatic ||
        (item.paletteColorLookupTableUID !== null &&
          item.paletteColorLookupTableUID !== undefined),
    )
    .map((item) => item.identifier)
  const colorAssignments: DefaultOpticalPathPlan['colorAssignments'] = []
  if (visibleIdentifiers.length === 0) {
    for (const item of opticalPaths) {
      if (!item.isMonochromatic) continue
      if (colorAssignments.length >= DEFAULT_OPTICAL_PATH_COLORS.length) break
      colorAssignments.push({
        identifier: item.identifier,
        color: DEFAULT_OPTICAL_PATH_COLORS[colorAssignments.length],
      })
      visibleIdentifiers.push(item.identifier)
    }
  }
  return { visibleIdentifiers, colorAssignments }
}
