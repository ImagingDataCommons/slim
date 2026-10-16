import {
  buildRoiDescription,
  DEFAULT_MEASUREMENT_GROUP,
  type DescribableMeasurement,
  type DescribableRoi,
} from '../selectedRoiDescription'

const code = (CodeValue: string, CodeMeaning: string) => ({
  CodeValue,
  CodeMeaning,
  CodingSchemeDesignator: 'DCM',
})

function measurement(
  meaning: string,
  value: number,
  unit: string,
  opticalPath?: string,
): DescribableMeasurement {
  const source = {
    ConceptNameCodeSequence: [code('121112', 'Source of Measurement')],
    ReferencedSOPSequence: [{ ReferencedOpticalPathIdentifier: opticalPath }],
  }
  return {
    ConceptNameCodeSequence: [code('m', meaning)],
    MeasuredValueSequence: [
      {
        NumericValue: value,
        MeasurementUnitsCodeSequence: [code(unit, unit)],
      },
    ],
    ContentSequence: opticalPath === undefined ? undefined : [source],
  }
}

const roi: DescribableRoi = {
  scoord3d: { graphicType: 'POLYGON' },
  evaluations: [
    {
      ValueType: 'CODE',
      ConceptNameCodeSequence: [code('121071', 'Finding')],
      ConceptCodeSequence: [code('x', 'Tumor')],
    },
    {
      ValueType: 'TEXT',
      ConceptNameCodeSequence: [code('t', 'Comment')],
      TextValue: 'Looks odd',
    },
  ],
  measurements: [
    measurement('Area', 2, 'mm2'),
    measurement('Mean', 10.5, '{counts}', 'DAPI'),
    measurement('Max', 20, '{counts}', 'DAPI'),
  ],
}

describe('buildRoiDescription', () => {
  it('numbers the ROI from its 0-based index', () => {
    expect(buildRoiDescription(roi, 2, 'mm').attributes).toEqual([
      { label: '', value: 'ROI 3' },
    ])
    expect(buildRoiDescription(roi, -1, 'mm').attributes).toEqual([
      { label: '', value: 'ROI N/A' },
    ])
  })

  it('describes the graphic type and evaluations', () => {
    const description = buildRoiDescription(roi, 0, 'mm')
    expect(description.scoord).toEqual([
      { label: 'Graphic type', value: 'POLYGON' },
    ])
    expect(description.evaluations).toEqual([
      { label: 'Finding', value: 'Tumor' },
      { label: 'Comment', value: 'Looks odd' },
    ])
  })

  it('groups measurements by referenced optical path', () => {
    const { measurementGroups } = buildRoiDescription(roi, 0, 'mm')
    expect(measurementGroups.map((group) => group.identifier)).toEqual([
      DEFAULT_MEASUREMENT_GROUP,
      'DAPI',
    ])
    expect(measurementGroups[1].items.map((item) => item.label)).toEqual([
      'Mean',
      'Max',
    ])
  })

  it('formats measured values in the preferred unit', () => {
    const inMm = buildRoiDescription(roi, 0, 'mm').measurementGroups[0]
    const inUm = buildRoiDescription(roi, 0, 'µm').measurementGroups[0]
    expect(inMm.items[0].value).toContain('mm²')
    expect(inUm.items[0].value).toContain('µm²')
  })

  it('uses the default group when the source has no optical path', () => {
    const withoutPath: DescribableRoi = {
      ...roi,
      measurements: [
        {
          ...measurement('Area', 1, 'mm2'),
          ContentSequence: [
            {
              ConceptNameCodeSequence: [
                code('121112', 'Source of Measurement'),
              ],
            },
          ],
        },
      ],
    }
    expect(
      buildRoiDescription(withoutPath, 0, 'mm').measurementGroups[0].identifier,
    ).toBe(DEFAULT_MEASUREMENT_GROUP)
  })
})
