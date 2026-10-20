/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import type DicomWebManager from '../../../DicomWebManager'
import { logger } from '../../../utils/logger'
import { loadDerivedData } from '../services/derivedDataLoaders'
import type { ViewerSession } from '../services/viewerSession'
import { classifyDerivedDataset } from '../utils/derivedDataset'
import type { AnnotationGroupsApi } from './useAnnotationGroups'
import type { HoveredRoiTooltipApi } from './useHoveredRoiTooltip'
import { useLatestRef } from './useLatestRef'
import type { OpticalPathsApi } from './useOpticalPaths'
import type { ParametricMapsApi } from './useParametricMaps'
import type { PresentationStatesApi } from './usePresentationStates'
import type { RoisApi } from './useRois'
import type { SegmentationsApi } from './useSegmentations'
import type { ViewportLoadingApi } from './useViewportLoading'

export interface SlidePopulationSources {
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  /** Derived dataset opened through the URL, shown once everything loaded */
  derivedDataset: dmv.metadata.Dataset | undefined
  refreshSnapshot: () => void
  viewportLoading: Pick<ViewportLoadingApi, 'reset'>
  opticalPaths: Pick<OpticalPathsApi, 'reset' | 'showDefault' | 'showSeries'>
  presentationStates: Pick<PresentationStatesApi, 'load'>
  rois: Pick<
    RoisApi,
    'reset' | 'registerRoi' | 'showAll' | 'onVisibilityChanges'
  >
  annotationGroups: Pick<AnnotationGroupsApi, 'reset' | 'showSeries'>
  segmentations: Pick<SegmentationsApi, 'reset' | 'showSeries'>
  parametricMaps: Pick<ParametricMapsApi, 'reset' | 'showSeries'>
  hoveredRoiTooltip: Pick<HoveredRoiTooltipApi, 'reset'>
}

function showDerivedDataset(
  session: ViewerSession,
  dataset: dmv.metadata.Dataset,
  sources: SlidePopulationSources,
): void {
  logger.debug('Loading derived dataset:', dataset)
  const { SOPClassUID, SeriesInstanceUID } = dataset as {
    SOPClassUID: string
    SeriesInstanceUID: string
  }
  const derived = classifyDerivedDataset(SOPClassUID)
  switch (derived.kind) {
    case 'rois':
      sources.rois.showAll(session)
      logger.debug('Loading Comprehensive 3D SR')
      break
    case 'annotationGroups':
      sources.annotationGroups.showSeries(session, SeriesInstanceUID)
      break
    case 'segments':
      sources.segmentations.showSeries(session, SeriesInstanceUID)
      break
    case 'mappings':
      sources.parametricMaps.showSeries(session, SeriesInstanceUID)
      break
    case 'opticalPaths':
      sources.opticalPaths.showSeries(session, SeriesInstanceUID)
      break
    case 'unsupported':
      logger.debug(`TODO: Loading ${derived.label}`)
      break
    case 'unknown':
      break
  }
}

/**
 * Fill new viewers: reset the per-viewer panel state, show the default
 * optical paths, then load presentation states and derived data. Loads
 * finish later and use the hooks of the latest render.
 */
export function useSlidePopulation(
  sources: SlidePopulationSources,
): (session: ViewerSession) => void {
  const latestRef = useLatestRef(sources)
  return (session) => {
    const {
      clients,
      studyInstanceUID,
      refreshSnapshot,
      viewportLoading,
      opticalPaths,
      presentationStates,
      rois,
      annotationGroups,
      segmentations,
      parametricMaps,
      hoveredRoiTooltip,
    } = latestRef.current
    viewportLoading.reset()
    opticalPaths.reset()
    rois.reset()
    annotationGroups.reset()
    segmentations.reset()
    parametricMaps.reset()
    hoveredRoiTooltip.reset()

    opticalPaths.showDefault(session)
    presentationStates.load(session)
    /**
     * The SR loader settles at the first suitable report. When an SR link
     * showed every ROI, ROIs of reports retrieved afterwards are shown as
     * each report is added; ROIs the user hid meanwhile stay hidden.
     */
    let showsLateRois = false
    const lateRoiUids: string[] = []
    loadDerivedData(
      {
        session,
        clients,
        studyInstanceUID,
        onChange: () => {
          if (showsLateRois && lateRoiUids.length > 0 && !session.isDestroyed) {
            latestRef.current.rois.onVisibilityChanges(
              lateRoiUids.splice(0).map((uid) => ({ uid, isVisible: true })),
            )
          }
          refreshSnapshot()
        },
      },
      {
        registerRoi: (roi) => {
          latestRef.current.rois.registerRoi(session, roi)
          if (showsLateRois) lateRoiUids.push(roi.uid)
        },
        onLoaded: () => {
          const current = latestRef.current
          if (session.isDestroyed || current.derivedDataset === undefined) {
            return
          }
          showDerivedDataset(session, current.derivedDataset, current)
          showsLateRois =
            classifyDerivedDataset(
              (current.derivedDataset as { SOPClassUID: string }).SOPClassUID,
            ).kind === 'rois'
        },
      },
    )
  }
}
