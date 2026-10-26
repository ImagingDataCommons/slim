import { useEffect } from 'react'

import { ActiveSeriesService } from '../../../services/ActiveSeriesService'
import type { ViewerSessionRef } from '../services/viewerSession'
import { visibleDerivedSeriesUIDs } from '../utils/activeSeries'

/**
 * Tell the DICOM tag browser which series are on screen: the slide's series
 * plus the series of the visible derived data. Cleared on unmount. Runs only
 * when the slide, the viewer generation or a visible set changes, not on
 * every render, since it reads every group, segment and mapping of DMV.
 */
export function useActiveSeriesPublisher({
  sessionRef,
  seriesInstanceUID,
  visibleAnnotationGroupUIDs,
  visibleSegmentUIDs,
  visibleMappingUIDs,
  viewerGeneration,
}: {
  sessionRef: ViewerSessionRef
  seriesInstanceUID: string | undefined
  /** Snapshot generation; a rebuilt viewer has new derived items */
  viewerGeneration: number
  visibleAnnotationGroupUIDs: ReadonlySet<string>
  visibleSegmentUIDs: ReadonlySet<string>
  visibleMappingUIDs: ReadonlySet<string>
}): void {
  /** biome-ignore lint/correctness/useExhaustiveDependencies: generation gate */
  useEffect(() => {
    const viewer = sessionRef.current?.volumeViewer
    if (viewer === undefined) return
    const activeSeriesUID = seriesInstanceUID ?? ''
    try {
      ActiveSeriesService.setActiveSeries(
        activeSeriesUID,
        visibleDerivedSeriesUIDs(
          {
            annotationGroups: viewer.getAllAnnotationGroups(),
            segments: viewer.getAllSegments(),
            mappings: viewer.getAllParameterMappings(),
          },
          {
            annotationGroupUIDs: visibleAnnotationGroupUIDs,
            segmentUIDs: visibleSegmentUIDs,
            mappingUIDs: visibleMappingUIDs,
          },
        ),
      )
    } catch {
      /** The viewer may be in a transitional state */
    }
  }, [
    sessionRef,
    seriesInstanceUID,
    viewerGeneration,
    visibleAnnotationGroupUIDs,
    visibleSegmentUIDs,
    visibleMappingUIDs,
  ])

  useEffect(() => () => ActiveSeriesService.clear(), [])
}
