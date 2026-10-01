import {
  convertMeasuredValue,
  describeRoiMeasurement,
  describeRoiType,
  formatMeasuredValue,
  formatRoiAttributes,
  getRoiAttributes,
  type RoiEvaluationLike,
  type RoiLike,
} from '../roiDescription'

const codeEvaluation = (
  nameCode: string,
  nameMeaning: string,
  valueMeaning: string,
): RoiEvaluationLike => ({
  ValueType: 'CODE',
  ConceptNameCodeSequence: [{ CodeValue: nameCode, CodeMeaning: nameMeaning }],
  ConceptCodeSequence: [{ CodeValue: 'x', CodeMeaning: valueMeaning }],
})

const textEvaluation = (
  nameCode: string,
  nameMeaning: string,
  text: string,
): RoiEvaluationLike => ({
  ValueType: 'TEXT',
  ConceptNameCodeSequence: [{ CodeValue: nameCode, CodeMeaning: nameMeaning }],
  TextValue: text,
})

const category = codeEvaluation('276214006', 'Finding category', 'Tissue')
const findingType = codeEvaluation('121071', 'Finding', 'Tumor')
const algorithm = codeEvaluation('111001', 'Algorithm Name', 'Segmenter v2')

const areaMeasurement = (value: number, unit = 'mm2') => ({
  ConceptNameCodeSequence: [{ CodeValue: '42798000', CodeMeaning: 'area' }],
  MeasuredValueSequence: [
    {
      NumericValue: value,
      MeasurementUnitsCodeSequence: [{ CodeValue: unit, CodeMeaning: unit }],
    },
  ],
})

describe('describeRoiType', () => {
  it('prefers the finding type over the finding category', () => {
    const roi: RoiLike = {
      scoord3d: { graphicType: 'POLYGON' },
      evaluations: [category, findingType],
    }
    expect(describeRoiType(roi)).toBe('Polygon · Tumor')
  })

  it('falls back to the finding category', () => {
    expect(
      describeRoiType({
        scoord3d: { graphicType: 'POINT' },
        evaluations: [category],
      }),
    ).toBe('Point · Tissue')
  })

  it('ignores text items and unknown geometries pass through', () => {
    expect(
      describeRoiType({
        scoord3d: { graphicType: 'CUSTOM' },
        evaluations: [textEvaluation('121071', 'Finding', 'Free text')],
      }),
    ).toBe('CUSTOM')
    expect(describeRoiType({})).toBe('')
  })
})

describe('describeRoiMeasurement', () => {
  it('formats area in µm² with three significant digits', () => {
    expect(
      describeRoiMeasurement({
        measurements: [areaMeasurement(2.41234, 'um2')],
      }),
    ).toBe('Area 2.41 µm²')
  })

  it('maps mm and keeps unknown units', () => {
    expect(
      describeRoiMeasurement({
        measurements: [areaMeasurement(12.3456, 'mm')],
      }),
    ).toBe('Area 12.3 mm')
    expect(
      describeRoiMeasurement({ measurements: [areaMeasurement(1, 'px')] }),
    ).toBe('Area 1 px')
  })

  it('returns only the name without a measured value', () => {
    expect(
      describeRoiMeasurement({
        measurements: [
          {
            ConceptNameCodeSequence: [
              { CodeValue: '1', CodeMeaning: 'length' },
            ],
          },
        ],
      }),
    ).toBe('Length')
  })

  it('returns undefined without measurements', () => {
    expect(describeRoiMeasurement({})).toBeUndefined()
    expect(describeRoiMeasurement({ measurements: [] })).toBeUndefined()
  })
})

describe('formatMeasuredValue', () => {
  it('honours the requested precision', () => {
    expect(formatMeasuredValue(1234.5678, 'mm2')).toBe('1230 mm²')
    expect(
      formatMeasuredValue(0.000123456, 'mm2', { significantDigits: 2 }),
    ).toBe('0.00012 mm²')
    expect(formatMeasuredValue('3.14159', '', { significantDigits: 4 })).toBe(
      '3.142',
    )
  })

  it('converts lengths and areas to the requested unit', () => {
    expect(formatMeasuredValue(1.5, 'mm', { unit: 'µm' })).toBe('1500 µm')
    expect(formatMeasuredValue(250, 'um', { unit: 'mm' })).toBe('0.25 mm')
    expect(formatMeasuredValue(0.002, 'mm2', { unit: 'µm' })).toBe('2000 µm²')
    expect(formatMeasuredValue(5e6, 'um2', { unit: 'mm' })).toBe('5 mm²')
  })

  it('leaves values in other units unchanged', () => {
    expect(formatMeasuredValue(12, 'deg', { unit: 'mm' })).toBe('12 deg')
    expect(formatMeasuredValue('n/a', 'mm', { unit: 'µm' })).toBe('n/a mm')
  })
})

describe('convertMeasuredValue', () => {
  it('returns UCUM codes for the target unit', () => {
    expect(convertMeasuredValue(2, 'mm', 'mm')).toEqual({
      value: 2,
      unitCode: 'mm',
    })
    expect(convertMeasuredValue(3, 'µm²', 'mm')).toEqual({
      value: 3e-6,
      unitCode: 'mm2',
    })
  })
})

describe('describeRoiMeasurement with units', () => {
  it('converts the first measurement', () => {
    expect(
      describeRoiMeasurement(
        {
          measurements: [
            {
              ConceptNameCodeSequence: [
                { CodeValue: '1', CodeMeaning: 'area' },
              ],
              MeasuredValueSequence: [
                {
                  NumericValue: 0.5,
                  MeasurementUnitsCodeSequence: [
                    { CodeValue: 'mm2', CodeMeaning: 'square millimeter' },
                  ],
                },
              ],
            },
          ],
        },
        { unit: 'µm' },
      ),
    ).toBe('Area 500000 µm²')
  })
})

describe('getRoiAttributes', () => {
  it('surfaces algorithm, free text, extra evaluations and measurements', () => {
    const roi: RoiLike = {
      evaluations: [
        findingType,
        category,
        algorithm,
        textEvaluation('121106', 'comment', 'Needs review'),
        codeEvaluation('999', 'margin', 'Clear'),
      ],
      measurements: [areaMeasurement(2), areaMeasurement(5.5555, 'um2')],
    }
    const attributes = getRoiAttributes(roi)
    expect(attributes).toEqual([
      { name: 'Property category', value: 'Tissue' },
      { name: 'Algorithm', value: 'Segmenter v2' },
      { name: 'Comment', value: 'Needs review' },
      { name: 'Margin', value: 'Clear' },
      { name: 'Area', value: '5.56 µm²' },
    ])
    expect(formatRoiAttributes(attributes.slice(1, 3))).toBe(
      'Algorithm: Segmenter v2 · Comment: Needs review',
    )
  })

  it('omits the category when it is already the type label', () => {
    expect(getRoiAttributes({ evaluations: [category] })).toEqual([])
  })
})
