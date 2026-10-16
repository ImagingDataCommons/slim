/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type OlMap from 'ol/Map'

import { roiStrokeToCssColor } from '../../../components/SlideViewer/utils/roiUtils'
import { adaptRoiToAnnotation } from '../../../services/RoiToAnnotationAdapter'
import type { AnnotationCategoryAndType } from '../../../types/annotations'
import type {
  AnnotationGroupStyle,
  AnnotationStyle,
  MappingStyle,
  OpticalPathStyle,
} from '../../../types/layerStyles'
import type { GoToRanges } from '../utils/goTo'
import { sortByIdentifier } from '../utils/opticalPathOrder'
import type { ViewerSegmentStyle } from '../utils/segmentStyles'
import { reuseEqualStyles } from '../utils/stableStyles'
import {
  reuseIdenticalArray,
  reuseIdenticalArrayRecord,
  reuseIdenticalRecord,
} from '../utils/stableValues'
import type { ViewerSession } from './viewerSession'

const ROI_FALLBACK_COLOR = 'rgb(var(--primary))'

/** DMV annotation groups also name the image series they annotate */
type AnnotationGroupItem = dmv.annotation.AnnotationGroup & {
  referencedSeriesInstanceUID: string
}

/**
 * Immutable copy of everything the slide viewer renders from the DMV
 * viewers. Unchanged parts keep their identity between reads.
 */
export interface ViewerSnapshot {
  /** 0 until the first viewer exists */
  generation: number
  labelViewer: dmv.viewer.LabelImageViewer | undefined
  getMap: () => OlMap | undefined
  goToRanges: GoToRanges
  rois: dmv.roi.ROI[]
  /** CSS stroke color by ROI UID */
  roiColors: Readonly<Record<string, string>>
  annotations: AnnotationCategoryAndType[]
  annotationStyles: Record<string, AnnotationStyle>
  /** Groups annotating one of the slide's series */
  annotationGroups: dmv.annotation.AnnotationGroup[]
  annotationGroupMetadata: Record<
    string,
    dmv.metadata.MicroscopyBulkSimpleAnnotations
  >
  annotationGroupStyles: Readonly<Record<string, AnnotationGroupStyle>>
  segments: dmv.segment.Segment[]
  segmentMetadata: Record<string, dmv.metadata.Segmentation[]>
  segmentStyles: Readonly<Record<string, ViewerSegmentStyle>>
  mappings: dmv.mapping.ParameterMapping[]
  mappingMetadata: Record<string, dmv.metadata.ParametricMap[]>
  mappingStyles: Readonly<Record<string, MappingStyle>>
  /** Sorted by identifier */
  opticalPaths: dmv.opticalPath.OpticalPath[]
  opticalPathMetadata: Record<
    string,
    dmv.metadata.VLWholeSlideMicroscopyImage[]
  >
  opticalPathStyles: Readonly<Record<string, OpticalPathStyle>>
  hasIccProfiles: boolean
  isPaletteDisplayGammaCorrectionEnabled: boolean
}

export const EMPTY_VIEWER_SNAPSHOT: ViewerSnapshot = {
  generation: 0,
  labelViewer: undefined,
  getMap: () => undefined,
  goToRanges: { x: [0, 0], y: [0, 0] },
  rois: [],
  roiColors: {},
  annotations: [],
  annotationStyles: {},
  annotationGroups: [],
  annotationGroupMetadata: {},
  annotationGroupStyles: {},
  segments: [],
  segmentMetadata: {},
  segmentStyles: {},
  mappings: [],
  mappingMetadata: {},
  mappingStyles: {},
  opticalPaths: [],
  opticalPathMetadata: {},
  opticalPathStyles: {},
  hasIccProfiles: false,
  isPaletteDisplayGammaCorrectionEnabled: false,
}

function readRoiColor(
  volumeViewer: dmv.viewer.VolumeImageViewer,
  uid: string,
): string {
  let color: number[] | undefined
  try {
    color = volumeViewer.getROIStyle(uid)?.stroke?.color
  } catch {
    /** ROIs being removed may no longer have a style */
    color = undefined
  }
  return roiStrokeToCssColor(color, ROI_FALLBACK_COLOR)
}

function mapByUid<I, V>(
  items: readonly I[],
  key: (item: I) => string,
  value: (item: I) => V,
): Record<string, V> {
  const result: Record<string, V> = {}
  for (const item of items) result[key(item)] = value(item)
  return result
}

function readSessionConstants(
  session: ViewerSession,
  previous: ViewerSnapshot,
): Pick<
  ViewerSnapshot,
  'generation' | 'labelViewer' | 'getMap' | 'goToRanges'
> {
  if (previous.generation === session.generation) {
    return previous
  }
  const { volumeViewer } = session
  const [offset, size] = volumeViewer.boundingBox
  return {
    generation: session.generation,
    labelViewer: session.labelViewer,
    /**
     * Overlays can mount with an older snapshot for one commit after the
     * session is destroyed, so they must not subscribe to its map.
     */
    getMap: () => (session.isDestroyed ? undefined : volumeViewer.getMap()),
    goToRanges: {
      x: [offset[0], offset[0] + size[0]],
      y: [offset[1], offset[1] + size[1]],
    },
  }
}

/** Read the session's viewers; `previous` supplies identities to reuse */
export function readViewerSnapshot(
  session: ViewerSession,
  previous: ViewerSnapshot,
): ViewerSnapshot {
  const { volumeViewer: viewer, slide, roiStyles } = session
  const constants = readSessionConstants(session, previous)

  const rois: dmv.roi.ROI[] = viewer.getAllROIs()

  const allAnnotationGroups: AnnotationGroupItem[] =
    viewer.getAllAnnotationGroups()
  const annotationGroups = reuseIdenticalArray(
    previous.annotationGroups,
    allAnnotationGroups.filter((group) =>
      slide.seriesInstanceUIDs.includes(group.referencedSeriesInstanceUID),
    ),
  )
  const segments = reuseIdenticalArray<dmv.segment.Segment>(
    previous.segments,
    viewer.getAllSegments(),
  )
  const mappings = reuseIdenticalArray(
    previous.mappings,
    viewer.getAllParameterMappings(),
  )
  const opticalPaths = reuseIdenticalArray<dmv.opticalPath.OpticalPath>(
    previous.opticalPaths,
    sortByIdentifier(viewer.getAllOpticalPaths()),
  )

  const byUid = <I extends { uid: string }, V>(
    items: readonly I[],
    value: (uid: string) => V,
  ): Record<string, V> =>
    mapByUid(
      items,
      (item) => item.uid,
      (item) => value(item.uid),
    )
  const byIdentifier = <V>(value: (identifier: string) => V) =>
    mapByUid(
      opticalPaths,
      (item) => item.identifier,
      (item) => value(item.identifier),
    )

  return {
    ...constants,
    rois,
    roiColors: byUid(rois, (uid) => readRoiColor(viewer, uid)),
    annotations: rois.map((roi) => adaptRoiToAnnotation(roi)),
    annotationStyles: reuseIdenticalRecord(
      previous.annotationStyles,
      roiStyles.copyAnnotationStyles(),
    ),
    annotationGroups,
    annotationGroupMetadata: reuseIdenticalRecord(
      previous.annotationGroupMetadata,
      byUid(annotationGroups, (uid) => viewer.getAnnotationGroupMetadata(uid)),
    ),
    annotationGroupStyles: reuseEqualStyles(
      previous.annotationGroupStyles,
      byUid(annotationGroups, (uid) => viewer.getAnnotationGroupStyle(uid)),
    ),
    segments,
    segmentMetadata: reuseIdenticalArrayRecord(
      previous.segmentMetadata,
      byUid(segments, (uid) => viewer.getSegmentMetadata(uid)),
    ),
    segmentStyles: reuseEqualStyles(
      previous.segmentStyles,
      byUid(segments, (uid) => {
        const style = viewer.getSegmentStyle(uid)
        return {
          opacity: style.opacity,
          paletteColorLookupTable: style.paletteColorLookupTable ?? undefined,
        }
      }),
    ),
    mappings,
    mappingMetadata: reuseIdenticalArrayRecord(
      previous.mappingMetadata,
      byUid(mappings, (uid) => viewer.getParameterMappingMetadata(uid)),
    ),
    mappingStyles: reuseEqualStyles(
      previous.mappingStyles,
      byUid(mappings, (uid) => {
        const style = viewer.getParameterMappingStyle(uid)
        return {
          opacity: style.opacity,
          paletteColorLookupTable: style.paletteColorLookupTable ?? undefined,
        }
      }),
    ),
    opticalPaths,
    opticalPathMetadata: reuseIdenticalArrayRecord(
      previous.opticalPathMetadata,
      byIdentifier((identifier) => viewer.getOpticalPathMetadata(identifier)),
    ),
    opticalPathStyles: reuseEqualStyles(
      previous.opticalPathStyles,
      byIdentifier((identifier) => ({
        ...viewer.getOpticalPathStyle(identifier),
      })),
    ),
    hasIccProfiles: viewer.getICCProfiles().length > 0,
    isPaletteDisplayGammaCorrectionEnabled:
      viewer.getPaletteDisplayGammaCorrectionEnabled(),
  }
}
