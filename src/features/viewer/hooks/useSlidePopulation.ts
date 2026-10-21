/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useEffect, useRef } from 'react'

import type DicomWebManager from '../../../DicomWebManager'
import { logger } from '../../../utils/logger'
import {
  loadDerivedData,
  notifyVisualizationError,
} from '../services/derivedDataLoaders'
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
  /** Derived dataset opened through the URL, shown once its kind loaded */
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

/** Whether a session's derived data finished loading and its URL dataset was shown */
interface PopulationProgress {
  session: ViewerSession
  /** Every loader settled */
  isLoaded: boolean
  /** Kinds whose own loader settled */
  settledKinds: Set<string>
  isShown: boolean
  /** The shown dataset is an SR, so ROIs of later reports are shown too */
  showsLateRois: boolean
}

/** Show the URL's derived dataset once the session's data has loaded */
function showDerivedWhenReady(
  progress: PopulationProgress | undefined,
  sources: SlidePopulationSources,
): void {
  const dataset = sources.derivedDataset
  if (
    progress === undefined ||
    progress.isShown ||
    progress.session.isDestroyed ||
    dataset === undefined
  ) {
    return
  }
  /** Shown once its own kind loaded; other kinds wait for every loader */
  const { kind } = classifyDerivedDataset(
    (dataset as { SOPClassUID: string }).SOPClassUID,
  )
  if (!progress.isLoaded && !progress.settledKinds.has(kind)) return
  /** Shown once: a dataset that throws would throw again */
  progress.isShown = true
  progress.showsLateRois = kind === 'rois'
  try {
    showDerivedDataset(progress.session, dataset, sources)
  } catch (error: unknown) {
    /** Reached from an effect too, where a throw would take the viewer down */
    logger.error('failed to show the derived dataset of the URL:', error)
    notifyVisualizationError('The linked dataset could not be displayed.')
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
  const progressRef = useRef<PopulationProgress | undefined>(undefined)
  /**
   * An in-app link to a derived series of the same slide rebuilds the
   * session before its referenced slide is looked up, so the dataset can
   * arrive after the loads finished; show it then
   */
  const { derivedDataset } = sources
  useEffect(() => {
    if (derivedDataset === undefined) return
    showDerivedWhenReady(progressRef.current, latestRef.current)
  }, [derivedDataset, latestRef])

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
    const progress: PopulationProgress = {
      session,
      isLoaded: false,
      settledKinds: new Set(),
      isShown: false,
      showsLateRois: false,
    }
    progressRef.current = progress
    const lateRoiUids: string[] = []
    loadDerivedData(
      {
        session,
        clients,
        studyInstanceUID,
        onChange: () => {
          if (
            progress.showsLateRois &&
            lateRoiUids.length > 0 &&
            !session.isDestroyed
          ) {
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
          if (progress.showsLateRois) lateRoiUids.push(roi.uid)
        },
        onSettled: (kind) => {
          progress.settledKinds.add(kind)
          showDerivedWhenReady(progress, latestRef.current)
        },
        onLoaded: () => {
          progress.isLoaded = true
          showDerivedWhenReady(progress, latestRef.current)
        },
      },
    )
  }
}
