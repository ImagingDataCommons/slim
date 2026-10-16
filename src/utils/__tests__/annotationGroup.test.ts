import {
  type AnnotationGroupItemLike,
  describeAnnotationGroup,
  findMeasurementByKey,
  getAnnotationGroupItem,
  getMeasurementKey,
  getMeasurementOptions,
  isFillableGraphicType,
} from '../annotationGroup'

const heartRate = {
  CodeValue: '8867-4',
  CodingSchemeDesignator: 'LN',
  CodeMeaning: 'Heart rate',
}
const area = {
  CodeValue: '42798000',
  CodingSchemeDesignator: 'SCT',
  CodeMeaning: 'Area',
}

const item: AnnotationGroupItemLike = {
  AnnotationGroupUID: '1.2.3',
  GraphicType: 'POLYGON',
  NumberOfAnnotations: 1234,
  MeasurementsSequence: [
    { ConceptNameCodeSequence: [heartRate] },
    { ConceptNameCodeSequence: [area] },
    { ConceptNameCodeSequence: [area] },
  ],
}

describe('getAnnotationGroupItem', () => {
  it('finds the item by UID', () => {
    expect(
      getAnnotationGroupItem({ AnnotationGroupSequence: [item] }, '1.2.3'),
    ).toBe(item)
  })

  it('returns undefined for unknown UIDs or missing metadata', () => {
    expect(
      getAnnotationGroupItem({ AnnotationGroupSequence: [item] }, 'x'),
    ).toBeUndefined()
    expect(getAnnotationGroupItem(undefined, '1.2.3')).toBeUndefined()
    expect(getAnnotationGroupItem({}, '1.2.3')).toBeUndefined()
  })
})

describe('getMeasurementOptions', () => {
  it('keeps hyphenated code values intact and dedupes concepts', () => {
    expect(getMeasurementOptions(item)).toEqual([
      {
        key: 'LN:8867-4',
        value: '8867-4',
        schemeDesignator: 'LN',
        meaning: 'Heart rate',
      },
      {
        key: 'SCT:42798000',
        value: '42798000',
        schemeDesignator: 'SCT',
        meaning: 'Area',
      },
    ])
  })

  it('returns no options without measurements', () => {
    expect(getMeasurementOptions(undefined)).toEqual([])
    expect(getMeasurementOptions({ AnnotationGroupUID: '1' })).toEqual([])
  })
})

describe('findMeasurementByKey', () => {
  it('matches the full hyphenated code', () => {
    const measurement = findMeasurementByKey(item, getMeasurementKey(heartRate))
    expect(measurement?.ConceptNameCodeSequence[0].CodeValue).toBe('8867-4')
  })

  it('does not match a truncated code', () => {
    expect(findMeasurementByKey(item, 'LN:8867')).toBeUndefined()
    expect(findMeasurementByKey(undefined, 'LN:8867-4')).toBeUndefined()
  })
})

describe('describeAnnotationGroup', () => {
  const group = {
    propertyType: { CodeMeaning: 'Nucleus' },
    propertyCategory: { CodeMeaning: 'Cell' },
  }

  it('builds meta, attributes and count', () => {
    expect(describeAnnotationGroup(group, item, '2D')).toEqual({
      meta: 'Nucleus · polygon',
      attributes: [
        { name: 'Property type', value: 'Nucleus' },
        { name: 'Property category', value: 'Cell' },
        { name: 'Graphic type', value: 'POLYGON' },
        { name: 'Annotation coordinate type', value: '2D' },
      ],
      count: 1234,
    })
  })

  it('tolerates a missing group item', () => {
    expect(describeAnnotationGroup(group, undefined)).toEqual({
      meta: 'Nucleus',
      attributes: [
        { name: 'Property type', value: 'Nucleus' },
        { name: 'Property category', value: 'Cell' },
      ],
      count: undefined,
    })
  })
})

describe('isFillableGraphicType', () => {
  it('accepts area graphic types only', () => {
    expect(isFillableGraphicType('POLYGON')).toBe(true)
    expect(isFillableGraphicType('ELLIPSE')).toBe(true)
    expect(isFillableGraphicType('POINT')).toBe(false)
    expect(isFillableGraphicType(undefined)).toBe(false)
  })
})
