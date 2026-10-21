/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { startTransition, useEffect, useMemo, useState } from 'react'

import type { SegmentStyle } from '../../../types/layerStyles'
import { logger } from '../../../utils/logger'
import type { VisibilityChange } from '../../../utils/visibility'
import type { DmvEventHandlers } from '../services/dmvEvents'
import {
  applyBinarySegmentPalettes,
  createSegmentPaletteColorLookupTable,
} from '../services/segmentPalettes'
import type { ViewerSession } from '../services/viewerSession'
import type { ViewerSnapshot } from '../services/viewerSnapshot'
import { groupBySeries, itemsForSeries } from '../utils/groupBySeries'
import {
  binarySegmentColors,
  recommendedBinarySegmentColors,
  segmentPanelStyles,
} from '../utils/segmentStyles'
import { showMatchingSeriesItems } from '../utils/showSeriesItems'
import {
  applyUidVisibility,
  applyUidVisibilityChanges,
  mirrorDmvVisibility,
} from '../utils/uidVisibility'
import { useInterpolationToggle } from './useInterpolationToggle'
import type { ViewerAccess } from './useViewerSession'

export interface SegmentationsApi {
  visibleUIDs: Set<string>
  /** Series filter of the panel; `undefined` lists every series */
  selectedSeriesUID: string | undefined
  panelStyles: Record<string, SegmentStyle>
  isInterpolationEnabled: boolean
  /** New viewers start with no segment shown */
  reset: () => void
  /** Show the segments of a series opened through the URL */
  showSeries: (session: ViewerSession, seriesInstanceUID: string) => void
  onVisibilityChange: (change: {
    segmentUID: string
    isVisible: boolean
  }) => void
  /** "Show all" / "Hide all": one pass, one state update; absent segments are skipped */
  onVisibilityChanges: (changes: VisibilityChange[]) => void
  onClick: (segmentUID: string) => void
  onStyleChange: (change: {
    segmentUID: string
    styleOptions: { opacity?: number; color?: number[] }
  }) => void
  /**
   * Live style while a slider is dragged: restyles the slide only. The panel
   * snapshot is refreshed once, by onStyleChange on commit.
   */
  onStylePreview: (change: {
    segmentUID: string
    styleOptions: { opacity?: number; color?: number[] }
  }) => void
  onSeriesChange: (seriesInstanceUID: string) => void
  onDisplaySettingsChange: (settings: { interpolationEnabled: boolean }) => void
  dmvHandlers: Required<
    Pick<DmvEventHandlers, 'dicommicroscopyviewer_segment_visibility_changed'>
  >
}

function segmentSeriesUID(
  viewer: dmv.viewer.VolumeImageViewer,
  segment: dmv.segment.Segment,
): string {
  return (
    viewer.getSegmentMetadata(segment.uid)?.[0]?.SeriesInstanceUID ?? 'unknown'
  )
}

/**
 * Only pass a palette when the user changed color. Opacity-only updates must
 * not send a default RGB for fractional segments or distinct colormaps are
 * replaced by a flat LUT.
 */
function applySegmentStyle(
  viewer: ViewerSession['volumeViewer'],
  segmentUID: string,
  { opacity, color }: { opacity?: number; color?: number[] },
): void {
  viewer.setSegmentStyle(segmentUID, {
    ...(opacity !== undefined ? { opacity } : {}),
    ...(color !== undefined
      ? {
          paletteColorLookupTable: createSegmentPaletteColorLookupTable(
            color,
            viewer.getPaletteDisplayGammaCorrectionEnabled(),
          ),
        }
      : {}),
  })
}

/**
 * Segments of the slide's segmentations. BINARY segments are drawn through
 * a two-color palette that follows the user's colors and gamma setting.
 */
export function useSegmentations(
  { sessionRef, refreshSnapshot }: ViewerAccess,
  {
    snapshot,
    isGammaCorrectionEnabled,
  }: {
    snapshot: Pick<
      ViewerSnapshot,
      'generation' | 'segments' | 'segmentMetadata' | 'segmentStyles'
    >
    isGammaCorrectionEnabled: boolean
  },
): SegmentationsApi {
  const [visibleUIDs, setVisibleUIDs] = useState<Set<string>>(() => new Set())
  const [selectedSeriesUID, setSelectedSeriesUID] = useState<
    string | undefined
  >(undefined)
  const [customizedColors, setCustomizedColors] = useState<
    Record<string, number[]>
  >({})
  const { isInterpolationEnabled, resetInterpolation, onInterpolationChange } =
    useInterpolationToggle(
      () => sessionRef.current?.volumeViewer.toggleSegmentationInterpolation(),
      false,
    )

  const { generation, segments, segmentMetadata, segmentStyles } = snapshot
  /** Segment Sequence lookups are only redone when segments are added */
  const recommendedColors = useMemo(
    () => recommendedBinarySegmentColors(segments, segmentMetadata),
    [segments, segmentMetadata],
  )
  const binaryColors = useMemo(
    () => binarySegmentColors(recommendedColors, customizedColors),
    [recommendedColors, customizedColors],
  )
  const panelStyles = useMemo(
    () => segmentPanelStyles(segments, segmentStyles, binaryColors),
    [segments, segmentStyles, binaryColors],
  )

  useEffect(() => {
    const session = sessionRef.current
    if (session === undefined || session.generation !== generation) return
    applyBinarySegmentPalettes(
      session.volumeViewer,
      binaryColors,
      isGammaCorrectionEnabled,
    )
  }, [sessionRef, generation, binaryColors, isGammaCorrectionEnabled])

  return {
    visibleUIDs,
    selectedSeriesUID,
    panelStyles,
    isInterpolationEnabled,
    reset: () => {
      setVisibleUIDs(new Set())
      setSelectedSeriesUID(undefined)
      resetInterpolation()
    },
    showSeries: (session, seriesInstanceUID) => {
      /**
       * One failing segment must not keep the others hidden. Background
       * and absent segments stay listed but are not shown. Panel series
       * filter follows the deep-linked series so Display options apply
       * with the same list the user opened.
       */
      setSelectedSeriesUID(seriesInstanceUID)
      showMatchingSeriesItems({
        items: session.volumeViewer.getAllSegments(),
        seriesInstanceUID,
        label: 'Segmentation',
        getSeriesInstanceUID: (segment) => segment.seriesInstanceUID,
        getId: (segment) => segment.uid,
        show: (uid) => session.volumeViewer.showSegment(uid),
        setVisible: setVisibleUIDs,
        shouldSkip: (segment) =>
          segment.isAbsent || segment.isBackground === true,
      })
    },
    onVisibilityChange: ({ segmentUID, isVisible }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      const segment = viewer
        .getAllSegments()
        .find((item) => item.uid === segmentUID)
      if (segment?.isAbsent) {
        logger.debug(
          `ignore visibility change for absent segment ${segmentUID}`,
        )
        return
      }
      logger.log(`change visibility of segment ${segmentUID}`)
      applyUidVisibility({
        uid: segmentUID,
        isVisible,
        show: (uid) => {
          logger.log(`show segment ${uid}`)
          viewer.showSegment(uid)
        },
        hide: (uid) => {
          logger.log(`hide segment ${uid}`)
          viewer.hideSegment(uid)
        },
        setVisibleUIDs,
      })
    },
    onVisibilityChanges: (changes) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      const absentUIDs = new Set(
        viewer
          .getAllSegments()
          .filter((segment) => segment.isAbsent)
          .map((segment) => segment.uid),
      )
      applyUidVisibilityChanges({
        changes: changes.filter((change) => !absentUIDs.has(change.uid)),
        show: (uid) => viewer.showSegment(uid),
        hide: (uid) => viewer.hideSegment(uid),
        setVisibleUIDs,
      })
    },
    onClick: (segmentUID) => {
      sessionRef.current?.volumeViewer.zoomToSegment(segmentUID)
    },
    onStyleChange: ({ segmentUID, styleOptions }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log(`change style of segment ${segmentUID}`)
      const { color } = styleOptions
      if (color !== undefined) {
        setCustomizedColors((current) => ({ ...current, [segmentUID]: color }))
      }
      applySegmentStyle(viewer, segmentUID, styleOptions)
      refreshSnapshot()
    },
    onStylePreview: ({ segmentUID, styleOptions }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      applySegmentStyle(viewer, segmentUID, styleOptions)
    },
    onSeriesChange: (seriesInstanceUID) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      /**
       * Switching series hides the previous segments; if any were shown,
       * every present segment of the new series is shown instead.
       */
      for (const uid of visibleUIDs) viewer.hideSegment(uid)
      const allSegments = viewer.getAllSegments()
      const seriesSegments = itemsForSeries(
        allSegments,
        groupBySeries(allSegments, (segment) =>
          segmentSeriesUID(viewer, segment),
        ),
        seriesInstanceUID,
      )
      const nextVisible = new Set<string>()
      if (visibleUIDs.size > 0) {
        for (const segment of seriesSegments) {
          if (!segment.isAbsent) nextVisible.add(segment.uid)
        }
      }
      startTransition(() => {
        setSelectedSeriesUID(seriesInstanceUID)
        setVisibleUIDs(nextVisible)
      })
      for (const uid of nextVisible) viewer.showSegment(uid)
    },
    onDisplaySettingsChange: ({ interpolationEnabled }) => {
      onInterpolationChange(interpolationEnabled)
      /**
       * DMV rebuilds every segment's sources on toggle. Re-assert visibility
       * from the viewer (not panel state) so a stale visibleUIDs set cannot
       * hide segments that were just shown via "Show all".
       */
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      for (const segment of viewer.getAllSegments()) {
        try {
          if (segment.isAbsent) continue
          if (viewer.isSegmentVisible(segment.uid)) {
            viewer.hideSegment(segment.uid)
            viewer.showSegment(segment.uid)
          }
        } catch (error) {
          logger.error(
            `failed to refresh segment "${segment.uid}" after interpolation toggle:`,
            error,
          )
        }
      }
    },
    dmvHandlers: {
      dicommicroscopyviewer_segment_visibility_changed: (payload) => {
        /**
         * The in-viewport legend already changed the overlay; only mirror
         * it into the panel.
         */
        mirrorDmvVisibility(
          setVisibleUIDs,
          payload?.segmentUID,
          payload?.isVisible,
        )
      },
    },
  }
}
