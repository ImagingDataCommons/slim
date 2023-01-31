import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'
import { Divider } from 'antd'
import { v4 as generateUUID } from 'uuid'

import Description from './Description'
import Patient from './Patient'
import Study from './Study'
import { findContentItemsByName } from '../utils/sr'
import { CustomError, errorTypes } from '../utils/CustomError'
import NotificationMiddleware, {
  NotificationMiddlewareContext
} from '../services/NotificationMiddleware'

export const hasValueType = (
  item: dcmjs.sr.valueTypes.ContentItem,
  valueType: string
): boolean => {
  return item.ValueType === valueType
}

const findMeasurementItems = (
  { content }: { content: dcmjs.sr.valueTypes.ContentItem[] }
): dcmjs.sr.valueTypes.NumContentItem[] => {
  const items: dcmjs.sr.valueTypes.NumContentItem[] = []
  content.forEach(i => {
    if (hasValueType(i, dcmjs.sr.valueTypes.ValueTypes.NUM)) {
      const measurement = i as dcmjs.sr.valueTypes.NumContentItem
      items.push(measurement)
    }
  })
  return items
}

const findEvaluationItems = (
  { content }: { content: dcmjs.sr.valueTypes.ContentItem[] }
): dcmjs.sr.valueTypes.CodeContentItem[] => {
  const items: dcmjs.sr.valueTypes.CodeContentItem[] = []
  content.forEach(i => {
    if (hasValueType(i, dcmjs.sr.valueTypes.ValueTypes.CODE)) {
      const evaluation = i as dcmjs.sr.valueTypes.CodeContentItem
      items.push(evaluation)
    }
  })
  return items
}

const getROIs = (report: dmv.metadata.Comprehensive3DSR): dmv.roi.ROI[] => {
  // TID 1500 Measurement Report
  const matches = findContentItemsByName({
    content: report.ContentSequence,
    name: new dcmjs.sr.coding.CodedConcept({
      value: '126010',
      schemeDesignator: 'DCM',
      meaning: 'Imaging Measurements'
    })
  })
  if (matches.length !== 1) {
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError(
        errorTypes.ENCODINGANDDECODING,
        'Content item "Imaging Measurements" not found.' +
        'Content of Comprehensive 3D SR document is not structured based on ' +
        'TID 1500 "Measurement Report".'
      )
    )
  }
  const measurementsItem = matches[0] as dcmjs.sr.valueTypes.ContainerContentItem
  // TID 1410 Planar ROI Measurements and Qualitative Evaluations
  const measurementGroupItems = findContentItemsByName({
    content: measurementsItem.ContentSequence,
    name: new dcmjs.sr.coding.CodedConcept({
      value: '125007',
      schemeDesignator: 'DCM',
      meaning: 'Measurement Group'
    })
  })

  const rois: dmv.roi.ROI[] = []
  measurementGroupItems.forEach((item) => {
    const evaluations = []
    let observerType: string
    const group = item as dcmjs.sr.valueTypes.ContainerContentItem
    let items = findContentItemsByName({
      content: group.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '112040',
        schemeDesignator: 'DCM',
        meaning: 'Tracking Unique Identifier'
      })
    })
    if (items.length === 0) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.ENCODINGANDDECODING,
          'Content item "Tracking Unique Identifier" not found. ' +
          'Content of Comprehensive 3D SR document is not structured ' +
          'based on TID 1500 "Measurement Report" -> ' +
          'TID 1410 "Planar ROI Measurements and Qualitative Evaluations".'
        )
      )
    }
    const trackingUIDItem = items[0] as dcmjs.sr.valueTypes.UIDRefContentItem

    items = findContentItemsByName({
      content: group.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '121071',
        schemeDesignator: 'DCM',
        meaning: 'Finding'
      })
    })
    if (items.length === 0) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.ENCODINGANDDECODING,
          'Content item "Finding" not found. ' +
          'Content of Comprehensive 3D SR document is not structured ' +
          'based on TID 1500 "Measurement Report" -> ' +
          'TID 1410 "Planar ROI Measurements and Qualitative Evaluations".'
        )
      )
    }

    items = findContentItemsByName({
      content: group.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '111001',
        schemeDesignator: 'DCM',
        meaning: 'Algorithm Name'
      })
    })
    if (items.length !== 0) {
      const algorithmNameItem = items[0] as dcmjs.sr.valueTypes.CodeContentItem
      evaluations.push(algorithmNameItem)
      observerType = 'Device'
    } else {
      observerType = 'Person'
    }

    items = findContentItemsByName({
      content: group.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '111003',
        schemeDesignator: 'DCM',
        meaning: 'Algorithm Version'
      })
    })
    if (items.length !== 0) {
      const algorithmVersionItem = items[0] as dcmjs.sr.valueTypes.CodeContentItem
      evaluations.push(algorithmVersionItem)
    }

    items = findContentItemsByName({
      content: group.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '111030',
        schemeDesignator: 'DCM',
        meaning: 'Image Region'
      })
    })
    if (items.length === 0) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.ENCODINGANDDECODING,
          'Content item "Image Region" not found. ' +
          'Content of Comprehensive 3D SR document is not structured ' +
          'based on TID 1500 "Measurement Report" -> ' +
          'TID 1410 "Planar ROI Measurements and Qualitative Evaluations".'
        )
      )
    }
    const regionItem = items[0] as dcmjs.sr.valueTypes.Scoord3DContentItem
    let scoord3d: any
    if (regionItem.GraphicType === 'POINT') {
      scoord3d = new dmv.scoord3d.Point({
        frameOfReferenceUID: regionItem.ReferencedFrameOfReferenceUID,
        coordinates: regionItem.GraphicData
      })
    } else {
      const coordinates: number[][] = []
      for (let i = 0; i < regionItem.GraphicData.length; i += 3) {
        coordinates.push(regionItem.GraphicData.slice(i, i + 3))
      }
      if (regionItem.GraphicType === 'POLYGON') {
        scoord3d = new dmv.scoord3d.Polygon({
          frameOfReferenceUID: regionItem.ReferencedFrameOfReferenceUID,
          coordinates: coordinates
        })
      } else if (regionItem.GraphicType === 'MULTIPOINT') {
        scoord3d = new dmv.scoord3d.MultiPoint({
          frameOfReferenceUID: regionItem.ReferencedFrameOfReferenceUID,
          coordinates: coordinates
        })
      } else if (regionItem.GraphicType === 'POLYLINE') {
        scoord3d = new dmv.scoord3d.Polyline({
          frameOfReferenceUID: regionItem.ReferencedFrameOfReferenceUID,
          coordinates: coordinates
        })
      } else if (regionItem.GraphicType === 'ELLIPSE') {
        scoord3d = new dmv.scoord3d.Ellipse({
          frameOfReferenceUID: regionItem.ReferencedFrameOfReferenceUID,
          coordinates: coordinates
        })
      } else if (regionItem.GraphicType === 'ELLIPSOID') {
        scoord3d = new dmv.scoord3d.Ellipsoid({
          frameOfReferenceUID: regionItem.ReferencedFrameOfReferenceUID,
          coordinates: coordinates
        })
      } else {
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.ENCODINGANDDECODING,
            'Content item "Image Region" has unknown graphic type ' +
            `"${regionItem.GraphicType}". ` +
            'Content of Comprehensive 3D SR document is not structured ' +
            'based on TID 1500 "Measurement Report" -> ' +
            'TID 1410 "Planar ROI Measurements and Qualitative Evaluations".'
          )
        )
      }
    }

    evaluations.push(
      ...findEvaluationItems({ content: group.ContentSequence })
    )
    const measurements = findMeasurementItems({
      content: group.ContentSequence
    })

    const roi = new dmv.roi.ROI({
      scoord3d: scoord3d,
      uid: generateUUID(),
      properties: {
        trackingUID: trackingUIDItem.UID,
        observerType: observerType,
        evaluations: evaluations,
        measurements: measurements
      }
    })
    rois.push(roi)
  })
  return rois
}

class MeasurementReport {
  public PersonObserverName?: string

  public PersonObserverLoginName?: string

  public DeviceObserverUID?: string

  public DeviceObserverName?: string

  public SpecimenUID: string

  public SpecimenIdentifier: string

  public ContainerIdentifier: string

  public ROIs: dmv.roi.ROI[] = []

  constructor (report: dmv.metadata.Comprehensive3DSR) {
    let items = findContentItemsByName({
      content: report.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '121039',
        schemeDesignator: 'DCM',
        meaning: 'Specimen UID'
      })
    })
    if (items.length === 0) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.ENCODINGANDDECODING,
          'Content item "Specimen UID" not found. ' +
          'Content of Comprehensive 3D SR document is not structured based on ' +
          'TID 1500 "Measurement Report" -> TID 1001 "Observation Context" -> ' +
          'TID 1006 "Subject Context" -> TID 1009 "Subject Context, Specimen".'
        )
      )
    }
    const specimenUIDItem = (
      items[0] as unknown as dcmjs.sr.valueTypes.UIDRefContentItem
    )
    this.SpecimenUID = specimenUIDItem.UID

    items = findContentItemsByName({
      content: report.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '121041',
        schemeDesignator: 'DCM',
        meaning: 'Specimen Identifier'
      })
    })
    if (items.length === 0) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.ENCODINGANDDECODING,
          'Content item "Specimen Identifier" not found. ' +
          'Content of Comprehensive 3D SR document is not structured based on ' +
          'TID 1500 "Measurement Report" -> TID 1001 "Observation Context" -> ' +
          'TID 1006 "Subject Context" -> TID 1009 "Subject Context, Specimen".'
        )
      )
    }
    const specimenIdItem = (
      items[0] as unknown as dcmjs.sr.valueTypes.TextContentItem
    )
    this.SpecimenIdentifier = specimenIdItem.TextValue

    items = findContentItemsByName({
      content: report.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '111700',
        schemeDesignator: 'DCM',
        meaning: 'Specimen Container Identifier'
      })
    })
    if (items.length === 0) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.ENCODINGANDDECODING,
          'Content item "Specimen Container Identifier" not found. ' +
          'Content of Comprehensive 3D SR document is not structured based on ' +
          'TID 1500 "Measurement Report" -> TID 1001 "Observation Context" -> ' +
          'TID 1006 "Subject Context" -> TID 1009 "Subject Context, Specimen".'
        )
      )
    }
    const containerIdItem = (
      items[0] as unknown as dcmjs.sr.valueTypes.TextContentItem
    )
    this.ContainerIdentifier = containerIdItem.TextValue

    items = findContentItemsByName({
      content: report.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '121008',
        schemeDesignator: 'DCM',
        meaning: 'Person Observer Name'
      })
    })
    if (items.length !== 0) {
      const personNameItem = (
        items[0] as unknown as dcmjs.sr.valueTypes.PNameContentItem
      )
      this.PersonObserverName = personNameItem.PersonName
    }

    items = findContentItemsByName({
      content: report.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '128774',
        schemeDesignator: 'DCM',
        meaning: "Person Observer's Login Name"
      })
    })
    if (items.length !== 0) {
      const personLoginNameItem = (
        items[0] as unknown as dcmjs.sr.valueTypes.TextContentItem
      )
      this.PersonObserverLoginName = personLoginNameItem.TextValue
    }

    items = findContentItemsByName({
      content: report.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '121012',
        schemeDesignator: 'DCM',
        meaning: 'Device Observer UID'
      })
    })
    if (items.length > 0) {
      const deviceUIDItem = (
        items[0] as unknown as dcmjs.sr.valueTypes.UIDRefContentItem
      )
      this.DeviceObserverUID = deviceUIDItem.UID
    }

    items = findContentItemsByName({
      content: report.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '121013',
        schemeDesignator: 'DCM',
        meaning: 'Device Observer Name'
      })
    })
    if (items.length !== 0) {
      const deviceNameItem = (
        items[0] as unknown as dcmjs.sr.valueTypes.TextContentItem
      )
      this.DeviceObserverName = deviceNameItem.TextValue
    }

    this.ROIs = getROIs(report)
  }
}

interface ReportProps {
  dataset: dmv.metadata.Comprehensive3DSR
}

/**
 * React component representing a DICOM SR document that displays the
 * document content (a selected subset of content items).
 */
class Report extends React.Component<ReportProps, {}> {
  render (): React.ReactNode {
    const report = new MeasurementReport(this.props.dataset)
    const containerAttrs = [
      {
        name: 'ID',
        value: report.ContainerIdentifier
      }
    ]
    const specimenAttrs = [
      {
        name: 'ID',
        value: report.SpecimenIdentifier
      }
    ]
    const observerAttrs = [
      {
        name: 'Name',
        value: report.PersonObserverName
      }
    ]
    const annotations = report.ROIs.map(
      (roi, index): React.ReactNode => {
        const id = `Region ${index + 1}`
        const attrs: Array<{ name: string, value: string }> = []
        roi.evaluations.forEach((
          item: (
            dcmjs.sr.valueTypes.CodeContentItem |
            dcmjs.sr.valueTypes.TextContentItem
          )
        ) => {
          if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.CODE) {
            item = item as dcmjs.sr.valueTypes.CodeContentItem
            attrs.push({
              name: item.ConceptNameCodeSequence[0].CodeMeaning,
              value: item.ConceptCodeSequence[0].CodeMeaning
            })
          } else if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.TEXT) {
            item = item as dcmjs.sr.valueTypes.TextContentItem
            attrs.push({
              name: item.ConceptNameCodeSequence[0].CodeMeaning,
              value: item.TextValue
            })
          }
        })
        return <Description key={roi.uid} header={id} attributes={attrs} />
      }
    )

    return (
      <div>
        <Divider orientation='left'>Patient</Divider>
        <Patient metadata={this.props.dataset} />
        <Divider orientation='left'>Case</Divider>
        <Study metadata={this.props.dataset} />
        <Divider orientation='left'>Slide</Divider>
        <Description attributes={containerAttrs} />
        <Divider orientation='left'>Specimen</Divider>
        <Description attributes={specimenAttrs} />
        <Divider orientation='left'>Observer</Divider>
        <Description attributes={observerAttrs} />
        <Divider orientation='left'>Annotations</Divider>
        {annotations}
      </div>
    )
  }
}

export default Report
export { MeasurementReport }
