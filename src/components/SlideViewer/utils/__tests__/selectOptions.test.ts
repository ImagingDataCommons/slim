import {
  buildCodedConceptOptions,
  buildGeometryTypeOptions,
  buildPresentationStateOptions,
  DEFAULT_PRESENTATION_STATE_VALUE,
  findOptionItem,
  fromPresentationStateValue,
  selectedConceptValue,
  toPresentationStateValue,
} from '../selectOptions'

const tumor = {
  CodeValue: '108369006',
  CodingSchemeDesignator: 'SCT',
  CodeMeaning: 'Tumor',
}
const necrosis = {
  CodeValue: '6574001',
  CodingSchemeDesignator: 'SCT',
  CodeMeaning: 'Necrosis',
}

describe('buildCodedConceptOptions', () => {
  it('values options by scheme and code', () => {
    expect(
      buildCodedConceptOptions([tumor, necrosis], 'finding').map(
        (option) => option.value,
      ),
    ).toEqual(['SCT-108369006', 'SCT-6574001'])
  })

  it('keeps the same code from different schemes distinct', () => {
    const local = { ...tumor, CodingSchemeDesignator: '99LOCAL' }
    expect(
      buildCodedConceptOptions([tumor, local], 'finding').map(
        (option) => option.value,
      ),
    ).toEqual(['SCT-108369006', '99LOCAL-108369006'])
  })

  it('gives missing and duplicate codes unique index-based values', () => {
    const options = buildCodedConceptOptions(
      [
        { CodeMeaning: 'A' },
        { CodeMeaning: 'B', CodeValue: '' },
        tumor,
        { ...tumor },
      ],
      'evaluation',
    )
    const values = options.map((option) => option.value)
    expect(values).toEqual([
      'evaluation-0',
      'evaluation-1',
      'SCT-108369006',
      'evaluation-3',
    ])
    expect(new Set(values).size).toBe(values.length)
  })

  it('keeps the concept on each option for lookup', () => {
    const options = buildCodedConceptOptions([tumor, necrosis], 'finding')
    expect(findOptionItem(options, 'SCT-6574001')).toBe(necrosis)
    expect(findOptionItem(options, 'missing')).toBeUndefined()
  })
})

describe('selectedConceptValue', () => {
  const options = buildCodedConceptOptions([tumor, necrosis], 'finding')

  it('finds the option for an equal concept', () => {
    expect(selectedConceptValue(options, { ...necrosis })).toBe('SCT-6574001')
  })

  it('returns an empty string for no or unknown selection', () => {
    expect(selectedConceptValue(options, undefined)).toBe('')
    expect(
      selectedConceptValue(options, { CodeValue: 'x', CodeMeaning: 'X' }),
    ).toBe('')
  })
})

describe('buildGeometryTypeOptions', () => {
  it('labels known geometry types and keeps unknown names', () => {
    expect(
      buildGeometryTypeOptions(['point', 'freehandline', 'ellipse', 'point']),
    ).toEqual([
      { value: 'point', label: 'Point', item: undefined },
      { value: 'freehandline', label: 'Line (freehand)', item: undefined },
      { value: 'ellipse', label: 'ellipse', item: undefined },
    ])
  })
})

describe('buildPresentationStateOptions', () => {
  it('lists states then the default sentinel', () => {
    expect(
      buildPresentationStateOptions([
        { SOPInstanceUID: '1.2', ContentDescription: 'Blend' },
        { SOPInstanceUID: '1.3' },
      ]),
    ).toEqual([
      { value: '1.2', label: 'Blend', item: undefined },
      { value: '1.3', label: 'Untitled', item: undefined },
      {
        value: DEFAULT_PRESENTATION_STATE_VALUE,
        label: 'Default',
        item: undefined,
      },
    ])
  })

  it('keeps values unique for missing or duplicate UIDs', () => {
    const values = buildPresentationStateOptions([
      { SOPInstanceUID: '' },
      { SOPInstanceUID: '1.2' },
      { SOPInstanceUID: '1.2' },
    ]).map((option) => option.value)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('presentation state value mapping', () => {
  it('round-trips UIDs and the sentinel', () => {
    expect(toPresentationStateValue(undefined)).toBe(
      DEFAULT_PRESENTATION_STATE_VALUE,
    )
    expect(toPresentationStateValue('1.2')).toBe('1.2')
    expect(
      fromPresentationStateValue(DEFAULT_PRESENTATION_STATE_VALUE),
    ).toBeUndefined()
    expect(fromPresentationStateValue('1.2')).toBe('1.2')
  })
})
