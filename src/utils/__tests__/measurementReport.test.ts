/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'

import NotificationMiddleware from '../../services/NotificationMiddleware'
import {
  describeEvaluations,
  MeasurementReport,
  parseMeasurementReport,
} from '../measurementReport'

vi.mock('dicom-microscopy-viewer', () => {
  class Scoord3D {
    graphicType: string
    options: unknown
    constructor(graphicType: string, options: unknown) {
      /** Like dmv, reject a region without a frame of reference */
      if (
        (options as { frameOfReferenceUID?: string }).frameOfReferenceUID ===
        undefined
      ) {
        throw new Error('No frame of reference UID')
      }
      this.graphicType = graphicType
      this.options = options
    }
  }
  const scoord = (graphicType: string) =>
    class extends Scoord3D {
      constructor(options: unknown) {
        super(graphicType, options)
      }
    }
  class ROI {
    options: { uid: string; properties: { evaluations: unknown[] } }
    constructor(options: {
      uid: string
      properties: { evaluations: unknown[] }
    }) {
      this.options = options
    }
    get uid(): string {
      return this.options.uid
    }
    get properties(): unknown {
      return this.options.properties
    }
    get evaluations(): unknown[] {
      return this.options.properties.evaluations
    }
  }
  return {
    scoord3d: {
      Point: scoord('POINT'),
      Polygon: scoord('POLYGON'),
      MultiPoint: scoord('MULTIPOINT'),
      Polyline: scoord('POLYLINE'),
      Ellipse: scoord('ELLIPSE'),
      Ellipsoid: scoord('ELLIPSOID'),
    },
    roi: { ROI },
  }
})

type ContentItem = dcmjs.sr.valueTypes.ContentItem

const code = (
  value: string,
  meaning: string,
  schemeDesignator = 'DCM',
): dcmjs.sr.coding.CodedConcept =>
  new dcmjs.sr.coding.CodedConcept({ value, meaning, schemeDesignator })

const uidItem = (
  name: dcmjs.sr.coding.CodedConcept,
  UID: string,
): dcmjs.sr.valueTypes.UIDRefContentItem => ({
  ConceptNameCodeSequence: [name],
  RelationshipType: 'HAS OBS CONTEXT',
  ValueType: 'UIDREF',
  UID,
})

const textItem = (
  name: dcmjs.sr.coding.CodedConcept,
  TextValue: string,
): dcmjs.sr.valueTypes.TextContentItem => ({
  ConceptNameCodeSequence: [name],
  RelationshipType: 'HAS OBS CONTEXT',
  ValueType: 'TEXT',
  TextValue,
})

const codeItem = (
  name: dcmjs.sr.coding.CodedConcept,
  value: dcmjs.sr.coding.CodedConcept,
): dcmjs.sr.valueTypes.CodeContentItem => ({
  ConceptNameCodeSequence: [name],
  RelationshipType: 'CONTAINS',
  ValueType: 'CODE',
  ConceptCodeSequence: [value],
})

const numItem = (
  name: dcmjs.sr.coding.CodedConcept,
): dcmjs.sr.valueTypes.NumContentItem => ({
  ConceptNameCodeSequence: [name],
  RelationshipType: 'CONTAINS',
  ValueType: 'NUM',
  MeasuredValueSequence: [
    {
      NumericValue: 1.5,
      MeasurementUnitsCodeSequence: [code('mm2', 'Square Millimeter', 'UCUM')],
    },
  ],
})

const regionItem = (
  GraphicType: string,
  GraphicData: number[],
): dcmjs.sr.valueTypes.Scoord3DContentItem => ({
  ConceptNameCodeSequence: [code('111030', 'Image Region')],
  RelationshipType: 'CONTAINS',
  ValueType: 'SCOORD3D',
  GraphicType,
  GraphicData,
  ReferencedFrameOfReferenceUID: '1.2.3.4',
})

const container = (
  name: dcmjs.sr.coding.CodedConcept,
  ContentSequence: ContentItem[],
): dcmjs.sr.valueTypes.ContainerContentItem => ({
  ConceptNameCodeSequence: [name],
  RelationshipType: 'CONTAINS',
  ValueType: 'CONTAINER',
  ContentSequence,
})

const area = code('42798000', 'Area', 'SCT')
const finding = codeItem(code('121071', 'Finding'), code('108369006', 'Tumor'))

const measurementGroup = (extra: ContentItem[] = []): ContentItem =>
  container(code('125007', 'Measurement Group'), [
    uidItem(code('112040', 'Tracking Unique Identifier'), '1.2.840.1'),
    finding,
    regionItem('POLYGON', [0, 0, 0, 1, 0, 0, 1, 1, 0]),
    numItem(area),
    ...extra,
  ])

const contextItems: ContentItem[] = [
  uidItem(code('121039', 'Specimen UID'), '2.25.1'),
  textItem(code('121041', 'Specimen Identifier'), 'S-1'),
  textItem(code('111700', 'Specimen Container Identifier'), 'C-1'),
]

const report = (groups: ContentItem[], context = contextItems) => ({
  ContentSequence: [
    ...context,
    container(code('126010', 'Imaging Measurements'), groups),
  ],
})

describe('parseMeasurementReport', () => {
  it('reads the specimen context and one ROI per measurement group', () => {
    const parsed = parseMeasurementReport(
      report([measurementGroup(), measurementGroup()]),
    )
    expect(parsed.warnings).toEqual([])
    expect(parsed.SpecimenUID).toBe('2.25.1')
    expect(parsed.SpecimenIdentifier).toBe('S-1')
    expect(parsed.ContainerIdentifier).toBe('C-1')
    expect(parsed.ROIs).toHaveLength(2)
    expect(parsed.ROIs[0].uid).not.toBe(parsed.ROIs[1].uid)
    expect(parsed.ROIs[0].properties).toMatchObject({
      trackingUID: '1.2.840.1',
      observerType: 'Person',
    })
    const { evaluations, measurements } = parsed.ROIs[0].properties
    expect(evaluations).toHaveLength(1)
    expect(evaluations[0]).toBeInstanceOf(dcmjs.sr.valueTypes.CodeContentItem)
    expect(evaluations[0]).toMatchObject({
      ConceptNameCodeSequence: [
        expect.objectContaining({ CodeValue: '121071' }),
      ],
      ConceptCodeSequence: [
        expect.objectContaining({ CodeValue: '108369006' }),
      ],
    })
    expect(measurements).toHaveLength(1)
    expect(measurements[0]).toBeInstanceOf(dcmjs.sr.valueTypes.NumContentItem)
    expect(measurements[0]).toMatchObject({
      ConceptNameCodeSequence: [
        expect.objectContaining({ CodeValue: '42798000' }),
      ],
      MeasuredValueSequence: [
        expect.objectContaining({
          NumericValue: 1.5,
          MeasurementUnitsCodeSequence: [
            expect.objectContaining({ CodeValue: 'mm2' }),
          ],
        }),
      ],
    })
  })

  it('reads person names from PNAME items', () => {
    const personItem: dcmjs.sr.valueTypes.PNameContentItem = {
      ConceptNameCodeSequence: [code('121008', 'Person Observer Name')],
      RelationshipType: 'HAS OBS CONTEXT',
      ValueType: 'PNAME',
      PersonName: 'Doe^Jane',
    }
    const parsed = parseMeasurementReport(
      report([], [...contextItems.slice(0, 3), personItem]),
    )
    expect(parsed.PersonObserverName).toBe('Doe^Jane')
  })

  it('marks algorithm output as device observations', () => {
    const algorithm = textItem(code('111001', 'Algorithm Name'), 'Seg v1')
    const parsed = parseMeasurementReport(
      report([measurementGroup([algorithm])]),
    )
    expect(parsed.ROIs[0].properties).toMatchObject({
      observerType: 'Device',
      evaluations: [algorithm, finding],
    })
  })

  it('skips a malformed CODE item and still loads the ROI', () => {
    const malformed = {
      ConceptNameCodeSequence: [code('371441004', 'Histological grade', 'SCT')],
      RelationshipType: 'CONTAINS',
      ValueType: 'CODE',
    } as unknown as ContentItem
    const parsed = parseMeasurementReport(
      report([measurementGroup([malformed])]),
    )

    expect(parsed.ROIs).toHaveLength(1)
    expect(parsed.ROIs[0].properties).toMatchObject({ evaluations: [finding] })
    expect(parsed.warnings).toEqual([
      expect.stringMatching(/Skipped a CODE content item/),
    ])
  })

  it('skips a CODE item without a concept name and still loads the ROI', () => {
    const nameless = {
      RelationshipType: 'CONTAINS',
      ValueType: 'CODE',
      ConceptCodeSequence: [code('G1', 'Grade 1', '99LOCAL')],
    } as unknown as ContentItem
    const parsed = parseMeasurementReport(
      report([measurementGroup([nameless])]),
    )

    expect(parsed.ROIs).toHaveLength(1)
    expect(parsed.warnings).toEqual([
      expect.stringMatching(/Skipped a CODE content item/),
    ])
  })

  it('keeps the source of a measurement so it stays tied to its channel', () => {
    const source = {
      ConceptNameCodeSequence: [code('121112', 'Source of Measurement')],
      RelationshipType: 'INFERRED FROM',
      ValueType: 'IMAGE',
      ReferencedSOPSequence: [
        {
          ReferencedSOPClassUID: '1.2.840.10008.5.1.4.1.1.77.1.6',
          ReferencedSOPInstanceUID: '1.2.3',
          ReferencedOpticalPathIdentifier: '2',
        },
      ],
    } as unknown as ContentItem
    const measurement = { ...numItem(area), ContentSequence: [source] }
    const parsed = parseMeasurementReport(
      report([
        container(code('125007', 'Measurement Group'), [
          uidItem(code('112040', 'Tracking Unique Identifier'), '1.2.840.1'),
          finding,
          regionItem('POLYGON', [0, 0, 0, 1, 0, 0, 1, 1, 0]),
          measurement as ContentItem,
        ]),
      ]),
    )

    const [rebuilt] = parsed.ROIs[0].properties.measurements
    expect(rebuilt).toBeInstanceOf(dcmjs.sr.valueTypes.NumContentItem)
    expect(rebuilt.ContentSequence).toEqual([source])
  })

  it('skips only the ROI whose image region is invalid', () => {
    const { ReferencedFrameOfReferenceUID: _, ...noFrame } = regionItem(
      'POLYGON',
      [0, 0, 0, 1, 0, 0, 1, 1, 0],
    )
    const broken = container(code('125007', 'Measurement Group'), [
      uidItem(code('112040', 'Tracking Unique Identifier'), '1.2.840.2'),
      finding,
      noFrame as ContentItem,
    ])
    const parsed = parseMeasurementReport(report([measurementGroup(), broken]))

    expect(parsed.ROIs).toHaveLength(1)
    expect(parsed.warnings).toEqual([
      expect.stringMatching(/"Image Region" is invalid/),
    ])
  })

  it('does not read a 2D SCOORD as an image region', () => {
    const planar = {
      ...regionItem('POLYGON', [0, 0, 1, 0, 1, 1]),
      ValueType: 'SCOORD',
    }
    const group = container(code('125007', 'Measurement Group'), [
      uidItem(code('112040', 'Tracking Unique Identifier'), '1.2.840.3'),
      finding,
      planar as ContentItem,
    ])
    const parsed = parseMeasurementReport(report([group]))

    expect(parsed.ROIs).toHaveLength(0)
    expect(parsed.warnings).toEqual([
      expect.stringMatching(/"Image Region" not found/),
    ])
  })

  it('lists a coded algorithm name once', () => {
    const algorithm = codeItem(
      code('111001', 'Algorithm Name'),
      code('A1', 'Seg model', '99LOCAL'),
    )
    const parsed = parseMeasurementReport(
      report([measurementGroup([algorithm])]),
    )
    const evaluations = (
      parsed.ROIs[0].properties as { evaluations: ContentItem[] }
    ).evaluations
    expect(evaluations).toHaveLength(2)
    expect(evaluations).toEqual([algorithm, finding])
  })

  it('reports missing specimen context instead of throwing', () => {
    const parsed = parseMeasurementReport(report([measurementGroup()], []))
    expect(parsed.SpecimenUID).toBeUndefined()
    expect(parsed.SpecimenIdentifier).toBeUndefined()
    expect(parsed.warnings).toHaveLength(3)
    expect(parsed.warnings[0]).toMatch(/"Specimen UID" not found/)
    expect(parsed.ROIs).toHaveLength(1)
  })

  it('returns no ROIs without an Imaging Measurements container', () => {
    const parsed = parseMeasurementReport({ ContentSequence: contextItems })
    expect(parsed.ROIs).toEqual([])
    expect(parsed.warnings).toEqual([
      expect.stringMatching(/"Imaging Measurements" not found/),
    ])
  })

  it('skips groups without a tracking UID or image region', () => {
    const withoutTracking = container(code('125007', 'Measurement Group'), [
      finding,
      regionItem('POINT', [1, 2, 0]),
    ])
    const withoutRegion = container(code('125007', 'Measurement Group'), [
      uidItem(code('112040', 'Tracking Unique Identifier'), '1'),
      finding,
    ])
    const parsed = parseMeasurementReport(
      report([withoutTracking, withoutRegion, measurementGroup()]),
    )
    expect(parsed.ROIs).toHaveLength(1)
    expect(parsed.warnings).toEqual([
      expect.stringMatching(/"Tracking Unique Identifier" not found/),
      expect.stringMatching(/"Image Region" not found/),
    ])
  })

  it('skips regions with an unknown graphic type', () => {
    const group = container(code('125007', 'Measurement Group'), [
      uidItem(code('112040', 'Tracking Unique Identifier'), '1'),
      finding,
      regionItem('CIRCLE', [0, 0, 0]),
    ])
    const parsed = parseMeasurementReport(report([group]))
    expect(parsed.ROIs).toEqual([])
    expect(parsed.warnings[0]).toMatch(/unknown graphic type "CIRCLE"/)
  })

  it('warns about a missing finding but keeps the ROI', () => {
    const group = container(code('125007', 'Measurement Group'), [
      uidItem(code('112040', 'Tracking Unique Identifier'), '1'),
      regionItem('POINT', [1, 2, 0]),
    ])
    const parsed = parseMeasurementReport(report([group]))
    expect(parsed.ROIs).toHaveLength(1)
    expect(parsed.warnings[0]).toMatch(/"Finding" not found/)
  })
})

describe('describeEvaluations', () => {
  it('lists code and text evaluations by concept name', () => {
    expect(
      describeEvaluations([
        finding,
        textItem(code('111001', 'Algorithm Name'), 'Seg v1'),
      ]),
    ).toEqual([
      { label: 'Finding', value: 'Tumor' },
      { label: 'Algorithm Name', value: 'Seg v1' },
    ])
  })
})

describe('MeasurementReport', () => {
  it('notifies each warning once on construction', () => {
    const onError = vi
      .spyOn(NotificationMiddleware, 'onError')
      .mockImplementation(() => undefined)
    const parsed = new MeasurementReport({ ContentSequence: [] })
    expect(parsed.ROIs).toEqual([])
    expect(onError).toHaveBeenCalledTimes(parsed.warnings.length)
    expect(parsed.warnings.length).toBeGreaterThan(0)
    onError.mockRestore()
  })
})
