import { sr } from 'dcmjs'
import type * as dmv from 'dicom-microscopy-viewer'
import NotificationMiddleware from '../../services/NotificationMiddleware'
import type { AppInfo } from '../appInfo'
import generateReport from '../generateReport'

const tumorFinding = new sr.valueTypes.CodeContentItem({
  name: new sr.coding.CodedConcept({
    value: '121071',
    schemeDesignator: 'DCM',
    meaning: 'Finding',
  }),
  value: new sr.coding.CodedConcept({
    value: '108369006',
    schemeDesignator: 'SCT',
    meaning: 'Tumor',
  }),
  relationshipType: 'CONTAINS',
})

function pointRoi(uid: string): dmv.roi.ROI {
  return {
    uid,
    scoord3d: {
      graphicType: 'POINT',
      graphicData: [10, 20, 0],
      frameOfReferenceUID: '1.2.3.9',
    },
    evaluations: [tumorFinding],
    measurements: [],
    properties: {},
  } as unknown as dmv.roi.ROI
}

const slide = {
  StudyInstanceUID: '1.2.3',
  SeriesInstanceUID: '1.2.3.1',
  SOPInstanceUID: '1.2.3.1.1',
  SOPClassUID: '1.2.840.10008.5.1.4.1.1.77.1.6',
  PatientID: 'C3L-00965',
  PatientName: 'C3L-00965',
  ContainerIdentifier: 'SLIDE-1',
  SpecimenDescriptionSequence: [
    { SpecimenUID: '1.2.3.5', SpecimenIdentifier: 'SPECIMEN-1' },
  ],
} as unknown as dmv.metadata.VLWholeSlideMicroscopyImage

describe('generateReport', () => {
  const app: AppInfo = {
    name: 'Slim',
    version: '0.0.0',
    homepage: 'https://github.com/ImagingDataCommons/slim',
    uid: '1.2.3.7',
  }

  it('encodes one measurement group per visible ROI', () => {
    const { generatedReport } = generateReport({
      rois: [pointRoi('1.2.3.10'), pointRoi('1.2.3.11')],
      metadata: [slide],
      user: undefined,
      app,
      visibleRoiUIDs: new Set(['1.2.3.10']),
    })

    const report = generatedReport as unknown as {
      ContentSequence: Array<{
        ConceptNameCodeSequence: Array<{ CodeValue: string }>
        ContentSequence?: unknown[]
      }>
    }
    const imagingMeasurements = report.ContentSequence.find(
      (item) => item.ConceptNameCodeSequence[0].CodeValue === '126010',
    )
    expect(imagingMeasurements?.ContentSequence).toHaveLength(1)
  })

  it('skips ROIs that have no Finding instead of throwing', () => {
    const onError = vi
      .spyOn(NotificationMiddleware, 'onError')
      .mockImplementation(() => undefined)
    const roiWithoutFinding = {
      ...pointRoi('1.2.3.12'),
      evaluations: [],
    } as unknown as dmv.roi.ROI

    const { generatedReport } = generateReport({
      rois: [roiWithoutFinding, pointRoi('1.2.3.13')],
      metadata: [slide],
      user: undefined,
      app,
      visibleRoiUIDs: new Set(['1.2.3.12', '1.2.3.13']),
    })

    const report = generatedReport as unknown as {
      ContentSequence: Array<{
        ConceptNameCodeSequence: Array<{ CodeValue: string }>
        ContentSequence?: unknown[]
      }>
    }
    const imagingMeasurements = report.ContentSequence.find(
      (item) => item.ConceptNameCodeSequence[0].CodeValue === '126010',
    )
    expect(imagingMeasurements?.ContentSequence).toHaveLength(1)
    expect(onError).toHaveBeenCalledTimes(1)
    onError.mockRestore()
  })
})
