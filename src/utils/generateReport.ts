import { roi, metadata } from 'dicom-microscopy-viewer'
import { sr, data } from 'dcmjs'

import { CustomError, errorTypes } from './CustomError'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import { User } from '../auth'

interface AppInfo {
  name: string
  version: string
  uid: string
  organization?: string
}

const generateReport = ({
  rois,
  metadata,
  user,
  app,
  visibleRoiUIDs,
}: {
  rois: roi.ROI[]
  metadata: metadata.VLWholeSlideMicroscopyImage[]
  user: User | undefined
  app: AppInfo
  visibleRoiUIDs: Set<string>
}): {
  isReportModalVisible: boolean
  generatedReport: metadata.Comprehensive3DSR
} => {
  // Metadata should be sorted such that the image with the highest
  // resolution is the last item in the array.
  const refImage = metadata[metadata.length - 1]
  // We assume that there is only one specimen (tissue section) per
  // ontainer (slide). Only the tissue section is tracked with a unique
  // identifier, even if the section may be composed of different biological
  // samples.
  if ((refImage.SpecimenDescriptionSequence?.length ?? 0) > 1) {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError(
        errorTypes.VISUALIZATION,
        'More than one specimen has been described for the slide',
      ),
    )
  }
  const refSpecimen = refImage.SpecimenDescriptionSequence[0]

  console.debug('create Observation Context')
  let observer

  if (user !== undefined) {
    observer = new sr.templates.PersonObserverIdentifyingAttributes({
      name: user.name ?? 'ANONYMOUS',
      loginName: user.email ?? '',
    })
  } else {
    console.warn('no user information available')
    observer = new sr.templates.PersonObserverIdentifyingAttributes({
      name: 'ANONYMOUS',
    })
  }

  const observationContext = new sr.templates.ObservationContext({
    observerPersonContext: new sr.templates.ObserverContext({
      observerType: new sr.coding.CodedConcept({
        value: '121006',
        schemeDesignator: 'DCM',
        meaning: 'Person',
      }),
      observerIdentifyingAttributes: observer,
    }),
    observerDeviceContext: new sr.templates.ObserverContext({
      observerType: new sr.coding.CodedConcept({
        value: '121007',
        schemeDesignator: 'DCM',
        meaning: 'Device',
      }),
      observerIdentifyingAttributes:
        new sr.templates.DeviceObserverIdentifyingAttributes({
          uid: app.uid,
          manufacturerName: 'MGH Computational Pathology',
          modelName: app.name,
        }),
    }),
    subjectContext: new sr.templates.SubjectContext({
      subjectClass: new sr.coding.CodedConcept({
        value: '121027',
        schemeDesignator: 'DCM',
        meaning: 'Specimen',
      }),
      subjectClassSpecificContext: new sr.templates.SubjectContextSpecimen({
        uid: refSpecimen.SpecimenUID,
        identifier: refSpecimen.SpecimenIdentifier,
        containerIdentifier: refImage.ContainerIdentifier,
      }),
    }),
  })

  console.debug('encode Imaging Measurements')
  const imagingMeasurements: sr.valueTypes.ContainerContentItem[] = []
  for (let i = 0; i < rois.length; i++) {
    const roi = rois[i]
    if (!visibleRoiUIDs.has(roi.uid)) {
      continue
    }

    let findingType = roi.evaluations.find(
      (item: sr.valueTypes.ContentItem) => {
        return item.ConceptNameCodeSequence[0].CodeValue === '121071'
      },
    )

    if (findingType === undefined) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.ENCODINGANDDECODING,
          `No finding type was specified for ROI "${String(roi.uid)}"`,
        ),
      )
    }

    findingType = findingType as sr.valueTypes.CodeContentItem

    const trackingIdentifier = new sr.templates.TrackingIdentifier({
      uid: roi.properties.trackingUID ?? roi.uid,
      identifier: `ROI #${i + 1}`,
    })

    const group =
      new sr.templates.PlanarROIMeasurementsAndQualitativeEvaluations({
        trackingIdentifier,
        referencedRegion: new sr.contentItems.ImageRegion3D({
          graphicType: roi.scoord3d.graphicType,
          graphicData: roi.scoord3d.graphicData,
          frameOfReferenceUID: roi.scoord3d.frameOfReferenceUID,
        }),
        findingType: new sr.coding.CodedConcept({
          value: findingType.ConceptCodeSequence[0].CodeValue,
          schemeDesignator:
            findingType.ConceptCodeSequence[0].CodingSchemeDesignator,
          meaning: findingType.ConceptCodeSequence[0].CodeMeaning,
        }),
        qualitativeEvaluations: roi.evaluations.filter(
          (item: sr.valueTypes.ContentItem) => {
            return item.ConceptNameCodeSequence[0].CodeValue !== '121071'
          },
        ),
        measurements: roi.measurements,
      })

    const measurements = group as sr.valueTypes.ContainerContentItem[]
    measurements[0].ContentTemplateSequence = [
      {
        MappingResource: 'DCMR',
        TemplateIdentifier: '1410',
      },
    ]
    imagingMeasurements.push(...measurements)
  }

  console.debug('create Measurement Report document content')
  const measurementReport = new sr.templates.MeasurementReport({
    languageOfContentItemAndDescendants:
      new sr.templates.LanguageOfContentItemAndDescendants({}),
    observationContext,
    procedureReported: new sr.coding.CodedConcept({
      value: '112703',
      schemeDesignator: 'DCM',
      meaning: 'Whole Slide Imaging',
    }),
    imagingMeasurements,
  })

  console.info('create Comprehensive 3D SR document')
  const dataset = new sr.documents.Comprehensive3DSR({
    content: measurementReport[0],
    evidence: [refImage],
    seriesInstanceUID: data.DicomMetaDictionary.uid(),
    seriesNumber: 1,
    seriesDescription: 'Annotation',
    sopInstanceUID: data.DicomMetaDictionary.uid(),
    instanceNumber: 1,
    manufacturer: 'MGH Computational Pathology',
    previousVersions: undefined, // TODO
  })

  return {
    isReportModalVisible: true,
    generatedReport: dataset as metadata.Comprehensive3DSR,
  }
}

export default generateReport
