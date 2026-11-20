import {
  describeSegment,
  formatAlgorithm,
  formatSegmentationType,
} from '../segment'

describe('formatSegmentationType', () => {
  it('title-cases the DICOM enumerated value', () => {
    expect(formatSegmentationType('FRACTIONAL')).toBe('Fractional')
    expect(formatSegmentationType('')).toBe('')
  })
})

describe('formatAlgorithm', () => {
  it('combines name and type when both exist', () => {
    expect(
      formatAlgorithm({ algorithmName: 'UNet', algorithmType: 'AUTOMATIC' }),
    ).toBe('UNet (AUTOMATIC)')
  })

  it('never renders undefined placeholders', () => {
    expect(formatAlgorithm({ algorithmType: 'MANUAL' })).toBe('MANUAL')
    expect(formatAlgorithm({ algorithmName: 'UNet' })).toBe('UNet')
    expect(formatAlgorithm({})).toBe('')
  })
})

describe('describeSegment', () => {
  it('builds meta and attributes', () => {
    expect(
      describeSegment(
        {
          algorithmName: 'UNet',
          algorithmType: 'AUTOMATIC',
          propertyType: { CodeMeaning: 'Nucleus' },
          propertyCategory: { CodeMeaning: 'Cell' },
        },
        'BINARY',
      ),
    ).toEqual({
      meta: 'Binary · UNet',
      attributes: [
        { name: 'Property type', value: 'Nucleus' },
        { name: 'Property category', value: 'Cell' },
        { name: 'Algorithm', value: 'UNet (AUTOMATIC)' },
        { name: 'Segmentation type', value: 'Binary' },
      ],
    })
  })

  it('omits missing algorithm information', () => {
    const { meta, attributes } = describeSegment(
      { propertyType: { CodeMeaning: 'Tumor' } },
      'FRACTIONAL',
    )
    expect(meta).toBe('Fractional')
    expect(attributes.map((attribute) => attribute.name)).toEqual([
      'Property type',
      'Segmentation type',
    ])
    expect(JSON.stringify(attributes)).not.toContain('undefined')
  })
})
