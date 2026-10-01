interface DerivedItem {
  uid: string
  seriesInstanceUID: string
}

/** Series of the annotation groups, segments and mappings currently shown */
export function visibleDerivedSeriesUIDs(
  items: {
    annotationGroups: readonly DerivedItem[]
    segments: readonly DerivedItem[]
    mappings: readonly DerivedItem[]
  },
  visible: {
    annotationGroupUIDs: ReadonlySet<string>
    segmentUIDs: ReadonlySet<string>
    mappingUIDs: ReadonlySet<string>
  },
): Set<string> {
  const series = new Set<string>()
  const collect = (
    list: readonly DerivedItem[],
    uids: ReadonlySet<string>,
  ): void => {
    for (const item of list) {
      if (uids.has(item.uid)) series.add(item.seriesInstanceUID)
    }
  }
  collect(items.annotationGroups, visible.annotationGroupUIDs)
  collect(items.segments, visible.segmentUIDs)
  collect(items.mappings, visible.mappingUIDs)
  return series
}
