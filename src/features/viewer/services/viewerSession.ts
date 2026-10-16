/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import {
  constructViewers,
  releaseViewer,
} from '../../../components/SlideViewer/utils/viewerUtils'
import type DicomWebManager from '../../../DicomWebManager'
import type { Slide } from '../../../data/slides'
import { codedConceptKey } from '../../../utils/dicom/codedConcept'
import { logger } from '../../../utils/logger'
import type { AnnotationConfig } from '../utils/annotationConfig'
import {
  type ClusteringSettings,
  DMV_DEFAULT_CLUSTERING_THRESHOLD_MM,
  resolveClusteringThreshold,
} from '../utils/displaySettings'
import type { PixelStatistics } from '../utils/pixelStatistics'
import { RoiStyleRegistry } from '../utils/roiStyleRegistry'

/**
 * DMV viewers of one slide plus the caches that live exactly as long as
 * they do. A new session replaces the old one whenever the slide is rebuilt.
 */
export interface ViewerSession {
  /** Starts at 1 and grows with every rebuild */
  readonly generation: number
  readonly slide: Slide
  readonly volumeViewer: dmv.viewer.VolumeImageViewer
  readonly labelViewer: dmv.viewer.LabelImageViewer | undefined
  readonly roiStyles: RoiStyleRegistry
  /** Frames requested but not yet loaded */
  readonly loadingFrames: Set<string>
  readonly pixelStatistics: Map<string, PixelStatistics>
  readonly annotationGroupMetadata: Map<
    string,
    dmv.metadata.MicroscopyBulkSimpleAnnotations
  >
  /** Set once the viewers were cleaned up; late async work must stop */
  isDestroyed: boolean
}

/**
 * Push clustering settings to DMV. `setAnnotationOptions` treats an
 * undefined threshold as "clustering off", so automatic mode sends DMV's
 * construction default instead.
 */
export function applyClusteringOptions(
  volumeViewer: dmv.viewer.VolumeImageViewer,
  { isEnabled, thresholdInput }: ClusteringSettings,
): void {
  try {
    volumeViewer.setAnnotationOptions({
      clusteringPixelSizeThreshold: resolveClusteringThreshold(
        isEnabled,
        thresholdInput,
        DMV_DEFAULT_CLUSTERING_THRESHOLD_MM,
      ),
    })
  } catch (error) {
    logger.error('failed to update annotation options:', error)
  }
}

export function createViewerSession({
  generation,
  slide,
  clients,
  preload,
  clustering,
  annotationConfig,
  defaultRoiStyle,
}: {
  generation: number
  slide: Slide
  clients: { [key: string]: DicomWebManager }
  preload: boolean
  clustering: ClusteringSettings
  annotationConfig: AnnotationConfig
  defaultRoiStyle: dmv.viewer.ROIStyleOptions
}): ViewerSession {
  /** An undefined threshold lets DMV use its automatic (zoom-based) default */
  const { volumeViewer, labelViewer } = constructViewers({
    clients,
    slide,
    preload,
    clusteringPixelSizeThreshold: resolveClusteringThreshold(
      true,
      clustering.thresholdInput,
    ),
  })
  try {
    if (!clustering.isEnabled) {
      applyClusteringOptions(volumeViewer, clustering)
    }
    /** Visibility is set later, possibly by a presentation state */
    for (const opticalPath of volumeViewer.getAllOpticalPaths()) {
      volumeViewer.deactivateOpticalPath(opticalPath.identifier)
    }
    return {
      generation,
      slide,
      volumeViewer,
      labelViewer,
      roiStyles: new RoiStyleRegistry({
        configuredStyles: annotationConfig.configuredStyles,
        findingKeys: annotationConfig.findings.map(codedConceptKey),
        defaultStyle: defaultRoiStyle,
      }),
      loadingFrames: new Set(),
      pixelStatistics: new Map(),
      annotationGroupMetadata: new Map(),
      isDestroyed: false,
    }
  } catch (error) {
    releaseViewer(volumeViewer)
    releaseViewer(labelViewer)
    throw error
  }
}

export interface ViewerSessionRef {
  readonly current: ViewerSession | undefined
}

/** Empty the viewer containers and release the DMV viewers, once */
export function destroyViewerSession(
  session: ViewerSession,
  containers: {
    volume: HTMLElement | null
    label: HTMLElement | null
  },
): void {
  if (session.isDestroyed) return
  session.isDestroyed = true
  if (containers.volume !== null) containers.volume.innerHTML = ''
  releaseViewer(session.volumeViewer)
  if (session.labelViewer !== undefined) {
    if (containers.label !== null) containers.label.innerHTML = ''
    releaseViewer(session.labelViewer)
  }
}
