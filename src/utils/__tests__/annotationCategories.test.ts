import {
  type AnnotationCategoryAndType,
  collectCategoryUids,
  getCategories,
  getCategoryVisibility,
  getConceptKey,
} from '../annotationCategories'

const tissue = {
  CodeValue: '85756007',
  CodingSchemeDesignator: 'SCT',
  CodeMeaning: 'Tissue',
}
const tumor = {
  CodeValue: '108369006',
  CodingSchemeDesignator: 'SCT',
  CodeMeaning: 'Tumor',
}
const otherTumor = {
  CodeValue: 'T-1',
  CodingSchemeDesignator: '99LOCAL',
  CodeMeaning: 'Tumor',
}
const stroma = {
  CodeValue: '13',
  CodingSchemeDesignator: 'SCT',
  CodeMeaning: 'Stroma',
}

const annotations: AnnotationCategoryAndType[] = [
  { uid: 'r1', category: tissue, type: tumor },
  { uid: 'r2', category: tissue, type: tumor },
  { uid: 'r3', category: tissue, type: otherTumor },
  { uid: 'r4', category: tissue, type: stroma },
]

describe('getConceptKey', () => {
  it('uses scheme and value, falling back to meaning', () => {
    expect(getConceptKey(tumor)).toBe('SCT:108369006')
    expect(getConceptKey({ CodeMeaning: 'Free text' })).toBe(
      'meaning:Free text',
    )
  })
})

describe('getCategories', () => {
  it('groups by code rather than meaning', () => {
    const categories = getCategories(annotations)
    expect(Object.keys(categories)).toEqual(['SCT:85756007'])
    const types = categories['SCT:85756007'].types
    expect(types.map((type) => [type.CodingSchemeDesignator, type.uids])).toEqual(
      [
        ['SCT', ['r1', 'r2']],
        ['99LOCAL', ['r3']],
        ['SCT', ['r4']],
      ],
    )
  })

  it('returns an empty record without annotations', () => {
    expect(getCategories(undefined)).toEqual({})
  })
})

describe('collectCategoryUids / getCategoryVisibility', () => {
  const category = getCategories(annotations)['SCT:85756007']

  it('collects all uids of a category', () => {
    expect(collectCategoryUids(category)).toEqual(['r1', 'r2', 'r3', 'r4'])
  })

  it('reports partial visibility as some', () => {
    expect(getCategoryVisibility(category, new Set(['r1']))).toBe('some')
    expect(getCategoryVisibility(category.types[0], ['r1'])).toBe('some')
    expect(getCategoryVisibility(category.types[0], ['r1', 'r2'])).toBe('all')
    expect(getCategoryVisibility(category, [])).toBe('none')
  })
})
