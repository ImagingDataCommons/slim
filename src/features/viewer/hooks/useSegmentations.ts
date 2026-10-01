/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useEffect, useMemo, useState } from 'react'

import type { SegmentStyle } from '../../../types/layerStyles'
import { logger } from '../../../utils/logger'
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
import { withItem, withItems, withoutItem } from '../utils/uidSets'
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
  onClick: (segmentUID: string) => void
  onStyleChange: (change: {
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
  const [isInterpolationEnabled, setIsInterpolationEnabled] = useState(false)

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
    },
    showSeries: (session, seriesInstanceUID) => {
      const allSegments = session.volumeViewer.getAllSegments()
      const matching = allSegments.filter(
        (segment) => segment.seriesInstanceUID === seriesInstanceUID,
      )
      logger.debug(
        'auto-load Segmentation: found ' +
          `${matching.length} matching segment(s) ` +
          `out of ${allSegments.length} total ` +
          `for series "${seriesInstanceUID}"`,
      )
      /**
       * One failing segment must not keep the others hidden. Background
       * segments stay listed but are not shown.
       */
      const shown: string[] = []
      for (const segment of matching) {
        if (segment.isAbsent) {
          logger.debug(
            `auto-load Segmentation: skipping absent segment "${segment.uid}"`,
          )
          continue
        }
        if (segment.isBackground === true) {
          logger.debug(
            `skipping auto-show for background segment "${segment.uid}"`,
          )
          continue
        }
        try {
          session.volumeViewer.showSegment(segment.uid)
          shown.push(segment.uid)
        } catch (error) {
          logger.error(`failed to auto-show segment "${segment.uid}":`, error)
        }
      }
      logger.debug(
        'auto-load Segmentation: showing ' +
          `${shown.length}/${matching.length} segment(s)`,
      )
      if (shown.length > 0) {
        setVisibleUIDs((current) => withItems(current, shown))
      }
      logger.debug('Loading Segmentation')
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
      if (isVisible) {
        logger.log(`show segment ${segmentUID}`)
        viewer.showSegment(segmentUID)
        setVisibleUIDs((current) => withItem(current, segmentUID))
      } else {
        logger.log(`hide segment ${segmentUID}`)
        viewer.hideSegment(segmentUID)
        setVisibleUIDs((current) => withoutItem(current, segmentUID))
      }
    },
    onClick: (segmentUID) => {
      sessionRef.current?.volumeViewer.zoomToSegment(segmentUID)
    },
    onStyleChange: ({ segmentUID, styleOptions }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log(`change style of segment ${segmentUID}`)
      const { color, opacity } = styleOptions
      if (color !== undefined) {
        setCustomizedColors((current) => ({ ...current, [segmentUID]: color }))
      }
      /**
       * Only pass a palette when the user changed color. Opacity-only
       * updates must not send a default RGB for fractional segments or
       * distinct colormaps are replaced by a flat LUT.
       */
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
      refreshSnapshot()
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
      setSelectedSeriesUID(seriesInstanceUID)
      setVisibleUIDs(nextVisible)
      for (const uid of nextVisible) viewer.showSegment(uid)
    },
    onDisplaySettingsChange: ({ interpolationEnabled }) => {
      if (interpolationEnabled === isInterpolationEnabled) return
      setIsInterpolationEnabled(interpolationEnabled)
      sessionRef.current?.volumeViewer.toggleSegmentationInterpolation()
    },
    dmvHandlers: {
      dicommicroscopyviewer_segment_visibility_changed: (payload) => {
        /**
         * The in-viewport legend already changed the overlay; only mirror
         * it into the panel.
         */
        if (payload?.segmentUID == null || payload.isVisible == null) return
        const { segmentUID, isVisible } = payload
        setVisibleUIDs((current) =>
          isVisible
            ? withItem(current, segmentUID)
            : withoutItem(current, segmentUID),
        )
      },
    },
  }
}
