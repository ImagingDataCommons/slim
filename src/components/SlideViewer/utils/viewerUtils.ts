/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'
import type { Slide } from '../../../data/slides'
import { StorageClasses } from '../../../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../../../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../../../utils/CustomError'
import {
  type CodedConceptLike,
  isSameCodedConcept,
} from '../../../utils/dicom/codedConcept'
import { logger } from '../../../utils/logger'
import { findContentItemsByName } from '../../../utils/sr'

const DCM = 'DCM'
const SUBJECT_CLASS: CodedConceptLike = {
  CodeValue: '121024',
  CodingSchemeDesignator: DCM,
}
const SPECIMEN: CodedConceptLike = {
  CodeValue: '121027',
  CodingSchemeDesignator: DCM,
}
const IMAGING_MEASUREMENTS: CodedConceptLike = {
  CodeValue: '126010',
  CodingSchemeDesignator: DCM,
}
const MEASUREMENT_GROUP: CodedConceptLike = {
  CodeValue: '125007',
  CodingSchemeDesignator: DCM,
}
const IMAGE_REGION: CodedConceptLike = {
  CodeValue: '111030',
  CodingSchemeDesignator: DCM,
}

const reportDmvError = (error: CustomError): void => {
  NotificationMiddleware.onError(NotificationMiddlewareContext.DMV, error)
}

/**
 * Constructs volume and label viewers for the slide
 */
export const constructViewers = ({
  clients,
  slide,
  preload,
  clusteringPixelSizeThreshold,
}: {
  clients: { [key: string]: dwc.api.DICOMwebClient }
  slide: Pick<Slide, 'volumeImages' | 'labelImages'>
  preload?: boolean
  clusteringPixelSizeThreshold?: number
}): {
  volumeViewer: dmv.viewer.VolumeImageViewer
  labelViewer?: dmv.viewer.LabelImageViewer
} => {
  logger.log(
    'instantiate viewer for VOLUME images of slide ' +
      `"${slide.volumeImages[0].ContainerIdentifier}"`,
  )
  try {
    const volumeViewer = new dmv.viewer.VolumeImageViewer({
      clientMapping: clients,
      metadata: slide.volumeImages,
      controls: ['overview'],
      /**
       * With THUMBNAIL levels in the pyramid (skipThumbnails unset), DMV would
       * otherwise lock the OpenLayers view to tile-grid resolutions. That clips
       * zoom-out so the full slide cannot fit the viewport. Disabling keeps
       * free zoom / fit-to-extent while still loading the thumbnail for a fast
       * first paint (see #389).
       */
      useTileGridResolutions: false,
      preload,
      annotationOptions:
        clusteringPixelSizeThreshold !== undefined
          ? { clusteringPixelSizeThreshold }
          : undefined,
      errorInterceptor: reportDmvError,
    })
    volumeViewer.activateSelectInteraction({})

    let labelViewer: dmv.viewer.LabelImageViewer | undefined
    if (slide.labelImages.length > 0) {
      logger.log(
        'instantiate viewer for LABEL image of slide ' +
          `"${slide.labelImages[0].ContainerIdentifier}"`,
      )
      labelViewer = new dmv.viewer.LabelImageViewer({
        client: clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE],
        metadata: slide.labelImages[0],
        resizeFactor: 1,
        orientation: 'vertical',
        errorInterceptor: reportDmvError,
      })
    }

    return { volumeViewer, labelViewer }
  } catch (error) {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError(errorTypes.VISUALIZATION, 'Failed to instantiate viewer'),
    )
    throw error
  }
}

/**
 * Checks if a report implements TID1500
 */
export const implementsTID1500 = (
  report: Pick<dmv.metadata.Comprehensive3DSR, 'ContentTemplateSequence'>,
): boolean => report.ContentTemplateSequence[0]?.TemplateIdentifier === '1500'

/**
 * Checks if a report describes a specimen subject
 */
export const describesSpecimenSubject = (
  report: Pick<dmv.metadata.Comprehensive3DSR, 'ContentSequence'>,
): boolean => {
  const [subjectClass] = findContentItemsByName({
    content: report.ContentSequence,
    name: SUBJECT_CLASS,
  })
  if (subjectClass === undefined) return false
  const value = (subjectClass as dcmjs.sr.valueTypes.CodeContentItem)
    .ConceptCodeSequence?.[0]
  return value !== undefined && isSameCodedConcept(value, SPECIMEN)
}

/**
 * Checks if a report contains appropriate graphic ROI annotations.
 */
export const containsROIAnnotations = (
  report: Pick<dmv.metadata.Comprehensive3DSR, 'ContentSequence'>,
): boolean => {
  const [measurements] = findContentItemsByName({
    content: report.ContentSequence,
    name: IMAGING_MEASUREMENTS,
  })
  if (measurements === undefined) return false
  return findContentItemsByName({
    content: measurements.ContentSequence ?? [],
    name: MEASUREMENT_GROUP,
  }).some((group) => {
    const [region] = findContentItemsByName({
      content: group.ContentSequence ?? [],
      name: IMAGE_REGION,
    })
    return region?.ValueType === dcmjs.sr.valueTypes.ValueTypes.SCOORD3D
  })
}
