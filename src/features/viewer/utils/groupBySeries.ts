/** Option value meaning "every series" in the series pickers */
export const ALL_SERIES = 'all'

/** Group items by series UID, keeping first-seen series order. */
export function groupBySeries<T>(
  items: readonly T[],
  getSeriesUID: (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const seriesUID = getSeriesUID(item)
    const group = groups.get(seriesUID)
    if (group === undefined) {
      groups.set(seriesUID, [item])
    } else {
      group.push(item)
    }
  }
  return groups
}

/**
 * The series a list shows: the selected one while it has items, otherwise
 * all series. A deep link can select a series whose items never reached the
 * viewer (another slide, a malformed instance); the list then shows the
 * loaded series instead of an empty list without a picker.
 */
export function shownSeries(
  groups: ReadonlyMap<string, readonly unknown[]>,
  selected: string | undefined,
): string {
  if (selected === undefined || selected === ALL_SERIES) return ALL_SERIES
  return (groups.get(selected)?.length ?? 0) > 0 ? selected : ALL_SERIES
}

/** Items of `selected`, or all items for `ALL_SERIES`/an unset selection. */
export function itemsForSeries<T>(
  items: readonly T[],
  groups: ReadonlyMap<string, readonly T[]>,
  selected: string | undefined,
): readonly T[] {
  if (selected === undefined || selected === ALL_SERIES) return items
  return groups.get(selected) ?? []
}

export interface SeriesOption {
  value: string
  label: string
}

/**
 * Picker options: an "all" entry followed by one entry per series, labeled
 * `<description> (<count> <unit>)`.
 */
export function buildSeriesOptions<T>({
  groups,
  allLabel,
  unit,
  describeSeries,
}: {
  groups: ReadonlyMap<string, readonly T[]>
  allLabel: string
  unit: string
  describeSeries: (seriesUID: string) => string
}): SeriesOption[] {
  return [
    { value: ALL_SERIES, label: allLabel },
    ...Array.from(groups, ([seriesUID, items]) => ({
      value: seriesUID,
      label: `${describeSeries(seriesUID)} (${items.length} ${unit})`,
    })),
  ]
}
