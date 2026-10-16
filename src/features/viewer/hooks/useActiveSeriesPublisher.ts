import { useEffect } from 'react'

import { ActiveSeriesService } from '../../../services/ActiveSeriesService'
import type { ViewerSessionRef } from '../services/viewerSession'
import { visibleDerivedSeriesUIDs } from '../utils/activeSeries'

/**
 * Tell the DICOM tag browser which series are on screen: the slide's series
 * plus the series of the visible derived data. Cleared on unmount.
 */
export function useActiveSeriesPublisher({
  sessionRef,
  seriesInstanceUID,
  visibleAnnotationGroupUIDs,
  visibleSegmentUIDs,
  visibleMappingUIDs,
}: {
  sessionRef: ViewerSessionRef
  seriesInstanceUID: string | undefined
  visibleAnnotationGroupUIDs: ReadonlySet<string>
  visibleSegmentUIDs: ReadonlySet<string>
  visibleMappingUIDs: ReadonlySet<string>
}): void {
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
  })

  useEffect(() => () => ActiveSeriesService.clear(), [])
}
