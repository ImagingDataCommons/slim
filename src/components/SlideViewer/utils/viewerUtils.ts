// skipcq: JS-C1003

// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
import * as dmv from 'dicom-microscopy-viewer'
// skipcq: JS-C1003
import type * as dwc from 'dicomweb-client'
import type { Slide } from '../../../data/slides'
import { StorageClasses } from '../../../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../../../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../../../utils/CustomError'
import { findContentItemsByName } from '../../../utils/sr'

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
  slide: Slide
  preload?: boolean
  clusteringPixelSizeThreshold?: number
}): {
  volumeViewer: dmv.viewer.VolumeImageViewer
  labelViewer?: dmv.viewer.LabelImageViewer
} => {
  console.info(
    'instantiate viewer for VOLUME images of slide ' +
      `"${slide.volumeImages[0].ContainerIdentifier}"`,
  )
  try {
    const volumeViewer = new dmv.viewer.VolumeImageViewer({
      clientMapping: clients,
      metadata: slide.volumeImages,
      controls: ['overview', 'position'],
      skipThumbnails: true,
      preload,
      annotationOptions:
        clusteringPixelSizeThreshold !== undefined
          ? { clusteringPixelSizeThreshold }
          : undefined,
      errorInterceptor: (error: CustomError) => {
        NotificationMiddleware.onError(NotificationMiddlewareContext.DMV, error)
      },
    })
    volumeViewer.activateSelectInteraction({})

    let labelViewer: dmv.viewer.LabelImageViewer | undefined
    if (slide.labelImages.length > 0) {
      console.info(
        'instantiate viewer for LABEL image of slide ' +
          `"${slide.labelImages[0].ContainerIdentifier}"`,
      )
      labelViewer = new dmv.viewer.LabelImageViewer({
        client: clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE],
        metadata: slide.labelImages[0],
        resizeFactor: 1,
        orientation: 'vertical',
        errorInterceptor: (error: CustomError) => {
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.DMV,
            error,
          )
        },
      })
    }

    return { volumeViewer, labelViewer }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
  report: dmv.metadata.Comprehensive3DSR,
): boolean => {
  const templateSeq = report.ContentTemplateSequence
  if (templateSeq.length > 0) {
    const tid = templateSeq[0].TemplateIdentifier
    if (tid === '1500') {
      return true
    }
  }
  return false
}

/**
 * Checks if a report describes a specimen subject
 */
export const describesSpecimenSubject = (
  report: dmv.metadata.Comprehensive3DSR,
): boolean => {
  const items = findContentItemsByName({
    content: report.ContentSequence,
    name: new dcmjs.sr.coding.CodedConcept({
      value: '121024',
      schemeDesignator: 'DCM',
      meaning: 'Subject Class',
    }),
  })
  if (items.length === 0) {
    return false
  }
  const subjectClassItem = items[0] as dcmjs.sr.valueTypes.CodeContentItem
  const subjectClassValue = subjectClassItem.ConceptCodeSequence[0]
  const retrievedConcept = new dcmjs.sr.coding.CodedConcept({
    value: subjectClassValue.CodeValue,
    meaning: subjectClassValue.CodeMeaning,
    schemeDesignator: subjectClassValue.CodingSchemeDesignator,
  })
  const expectedConcept = new dcmjs.sr.coding.CodedConcept({
    value: '121027',
    meaning: 'Specimen',
    schemeDesignator: 'DCM',
  })
  return retrievedConcept.equals(expectedConcept)
}

/**
 * Checks if a report contains appropriate graphic ROI annotations.
 */
export const containsROIAnnotations = (
  report: dmv.metadata.Comprehensive3DSR,
): boolean => {
  const measurements = findContentItemsByName({
    content: report.ContentSequence,
    name: new dcmjs.sr.coding.CodedConcept({
      value: '126010',
      schemeDesignator: 'DCM',
      meaning: 'Imaging Measurements',
    }),
  })
  if (measurements.length === 0) {
    return false
  }
  const container = measurements[0] as dcmjs.sr.valueTypes.ContainerContentItem
  const measurementGroups = findContentItemsByName({
    content: container.ContentSequence,
    name: new dcmjs.sr.coding.CodedConcept({
      value: '125007',
      schemeDesignator: 'DCM',
      meaning: 'Measurement Group',
    }),
  })

  let foundRegion = false
  measurementGroups.forEach((group) => {
    const container = group as dcmjs.sr.valueTypes.ContainerContentItem
    const regions = findContentItemsByName({
      content: container.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '111030',
        schemeDesignator: 'DCM',
        meaning: 'Image Region',
      }),
    })
    if (regions.length > 0) {
      if (regions[0].ValueType === dcmjs.sr.valueTypes.ValueTypes.SCOORD3D) {
        foundRegion = true
      }
    }
  })

  return foundRegion
}
