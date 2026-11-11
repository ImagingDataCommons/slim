/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useEffect, useRef, useState } from 'react'
import { type DebouncedFunction, debounce } from '../../../utils/debounce'
import { logger } from '../../../utils/logger'
import {
  HIDDEN_HOVERED_ROI_TOOLTIP,
  type HoveredRoiTooltipState,
} from '../components/HoveredRoiTooltipLayer'
import type { DmvEventHandlers, DmvEventPayload } from '../services/dmvEvents'
import {
  createExternalStore,
  type ExternalStore,
} from '../services/externalStore'
import type { ViewerSession, ViewerSessionRef } from '../services/viewerSession'
import {
  compareHoveredRois,
  describeBulkAnnotation,
  describeEvaluations,
  type HoveredFeature,
  type HoveredRoi,
  hoveredFeaturesSignature,
  visibleHoveredFeatures,
} from '../utils/hoveredRois'
import { useLatestRef } from './useLatestRef'

type PointerMovePayload = DmvEventPayload<'dicommicroscopyviewer_pointer_move'>
type HoveredRoiFeature = HoveredFeature<dmv.roi.ROI>

export interface HoveredRoiTooltipApi {
  store: ExternalStore<HoveredRoiTooltipState>
  /** Hide the tooltip and forget the hovered features, for new viewers */
  reset: () => void
  dmvHandlers: Required<
    Pick<DmvEventHandlers, 'dicommicroscopyviewer_pointer_move'>
  >
}

function describeHoveredFeature(
  session: ViewerSession,
  { roi, annotationGroupUID }: HoveredRoiFeature,
  rois: readonly dmv.roi.ROI[],
  describeSeries: (seriesInstanceUID: string) => string,
): HoveredRoi {
  if (annotationGroupUID !== null) {
    try {
      let metadata = session.annotationGroupMetadata.get(annotationGroupUID)
      if (metadata === undefined) {
        metadata =
          session.volumeViewer.getAnnotationGroupMetadata(annotationGroupUID)
        session.annotationGroupMetadata.set(annotationGroupUID, metadata)
      }
      const item = metadata.AnnotationGroupSequence.find(
        (group) => group.AnnotationGroupUID === annotationGroupUID,
      )
      if (item !== undefined) {
        const seriesUID = metadata.SeriesInstanceUID
        return describeBulkAnnotation({
          roiUid: roi.uid,
          item,
          seriesDescription:
            seriesUID !== undefined && seriesUID !== null
              ? describeSeries(seriesUID)
              : '',
        })
      }
    } catch (error) {
      logger.warn(
        `Failed to get annotation group metadata for ${annotationGroupUID}:`,
        error,
      )
    }
  }
  if (rois.length === 0) {
    return { index: 0, roiUid: roi.uid, attributes: [], seriesDescription: '' }
  }
  return {
    index: rois.findIndex((r) => r.uid === roi.uid) + 1,
    roiUid: roi.uid,
    attributes: describeEvaluations(roi.evaluations),
    seriesDescription: '',
  }
}

/**
 * Tooltip describing the visible ROIs and bulk annotations under the
 * pointer. It lives in its own store so pointer moves do not re-render the
 * viewer.
 */
export function useHoveredRoiTooltip({
  sessionRef,
  visibleRoiUIDs,
  visibleAnnotationGroupUIDs,
  describeSeries,
}: {
  sessionRef: ViewerSessionRef
  visibleRoiUIDs: ReadonlySet<string>
  visibleAnnotationGroupUIDs: ReadonlySet<string>
  describeSeries: (seriesInstanceUID: string) => string
}): HoveredRoiTooltipApi {
  const [store] = useState(() =>
    createExternalStore<HoveredRoiTooltipState>(HIDDEN_HOVERED_ROI_TOOLTIP),
  )
  const signatureRef = useRef<string | null>(null)

  const onPointerMove = (payload: PointerMovePayload): void => {
    const originalEvent = payload.event.originalEvent
    const features: HoveredRoiFeature[] = []
    for (const item of payload.features ?? []) {
      if (item.feature !== null && item.feature !== undefined) {
        features.push({
          roi: item.feature,
          annotationGroupUID: item.annotationGroupUID ?? null,
        })
      }
    }
    const hovered = visibleHoveredFeatures(
      features,
      visibleRoiUIDs,
      visibleAnnotationGroupUIDs,
    )
    if (hovered.length === 0) {
      signatureRef.current = null
      store.update((tooltip) =>
        tooltip.isVisible ? { ...tooltip, isVisible: false } : tooltip,
      )
      return
    }

    const signature = hoveredFeaturesSignature(hovered)
    const position = { x: originalEvent.clientX, y: originalEvent.clientY }
    const tooltip = store.getSnapshot()
    if (signatureRef.current === signature && tooltip.isVisible) {
      store.set({ ...tooltip, ...position })
      return
    }
    const session = sessionRef.current
    if (session === undefined) return
    signatureRef.current = signature
    const rois = session.volumeViewer.getAllROIs()
    store.set({
      isVisible: true,
      ...position,
      rois: hovered
        .map((feature) =>
          describeHoveredFeature(session, feature, rois, describeSeries),
        )
        .sort(compareHoveredRois),
    })
  }

  const onPointerMoveRef = useLatestRef(onPointerMove)
  const debouncedPointerMoveRef = useRef<DebouncedFunction<
    [PointerMovePayload]
  > | null>(null)
  useEffect(() => {
    const debounced = debounce(
      (payload: PointerMovePayload) => {
        onPointerMoveRef.current(payload)
      },
      0,
      { leading: true, trailing: true },
    )
    debouncedPointerMoveRef.current = debounced
    return () => {
      debounced.cancel()
      debouncedPointerMoveRef.current = null
    }
  }, [onPointerMoveRef])

  return {
    store,
    reset: () => {
      signatureRef.current = null
      store.set(HIDDEN_HOVERED_ROI_TOOLTIP)
    },
    dmvHandlers: {
      dicommicroscopyviewer_pointer_move: (payload) => {
        debouncedPointerMoveRef.current?.(payload)
      },
    },
  }
}
