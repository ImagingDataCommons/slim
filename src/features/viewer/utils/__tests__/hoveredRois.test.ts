import {
  annotationIndexFromRoiUid,
  compareHoveredRois,
  describeBulkAnnotation,
  describeEvaluations,
  groupHoveredRoisBySeries,
  type HoveredRoi,
  hoveredFeaturesSignature,
  UNKNOWN_SERIES,
  visibleHoveredFeatures,
} from '../hoveredRois'

const row = (
  index: number,
  seriesDescription: string,
  roiUid = `r${index}`,
): HoveredRoi => ({ index, roiUid, attributes: [], seriesDescription })

describe('annotationIndexFromRoiUid', () => {
  it('parses the numeric suffix after the last dash', () => {
    expect(annotationIndexFromRoiUid('1.2.3-17')).toBe(17)
    expect(annotationIndexFromRoiUid('a-b-4')).toBe(4)
  })

  it('falls back to 0 without a numeric suffix', () => {
    expect(annotationIndexFromRoiUid('1.2.3')).toBe(0)
    expect(annotationIndexFromRoiUid('1.2.3-x')).toBe(0)
  })
})

describe('describeBulkAnnotation', () => {
  it('lists series, label, category and type', () => {
    expect(
      describeBulkAnnotation({
        roiUid: 'g-4',
        seriesDescription: 'Nuclei',
        item: {
          AnnotationGroupLabel: 'Cells',
          AnnotationPropertyCategoryCodeSequence: [
            { CodeValue: 'c', CodeMeaning: 'Tissue' },
          ],
          AnnotationPropertyTypeCodeSequence: [
            { CodeValue: 't', CodeMeaning: '' },
          ],
        },
      }),
    ).toEqual({
      index: 5,
      roiUid: 'g-4',
      seriesDescription: 'Nuclei',
      attributes: [
        { name: 'Series Description', value: 'Nuclei' },
        { name: 'Annotation Group Label', value: 'Cells' },
        { name: 'Property category', value: 'Tissue' },
        { name: 'Property type', value: 't' },
      ],
    })
  })

  it('omits empty fields', () => {
    expect(
      describeBulkAnnotation({
        roiUid: 'g',
        seriesDescription: '',
        item: { AnnotationGroupLabel: '' },
      }).attributes,
    ).toEqual([])
  })
})

describe('describeEvaluations', () => {
  it('maps well-known codes to panel labels and keeps text values', () => {
    expect(
      describeEvaluations([
        {
          ValueType: 'CODE',
          ConceptNameCodeSequence: [
            { CodeValue: '121071', CodeMeaning: 'Finding' },
          ],
          ConceptCodeSequence: [{ CodeValue: 'x', CodeMeaning: 'Tumor' }],
        },
        {
          ValueType: 'CODE',
          ConceptNameCodeSequence: [{ CodeValue: 'o', CodeMeaning: 'Grade' }],
          ConceptCodeSequence: [{ CodeValue: 'y', CodeMeaning: 'High' }],
        },
        {
          ValueType: 'TEXT',
          ConceptNameCodeSequence: [{ CodeValue: 't', CodeMeaning: 'Note' }],
          TextValue: 'hi',
        },
        {
          ValueType: 'NUM',
          ConceptNameCodeSequence: [{ CodeValue: 'n', CodeMeaning: 'Ignored' }],
        },
      ]),
    ).toEqual([
      { name: 'Property type', value: 'Tumor' },
      { name: 'Grade', value: 'High' },
      { name: 'Note', value: 'hi' },
    ])
  })
})

describe('compareHoveredRois', () => {
  it('sorts by index, then series description', () => {
    const sorted = [row(2, 'b'), row(1, 'z'), row(2, 'a')].sort(
      compareHoveredRois,
    )
    expect(sorted.map((r) => `${r.index}${r.seriesDescription}`)).toEqual([
      '1z',
      '2a',
      '2b',
    ])
  })
})

describe('visibleHoveredFeatures', () => {
  const features = [
    { roi: { uid: 'sr1' }, annotationGroupUID: null },
    { roi: { uid: 'sr1' }, annotationGroupUID: null },
    { roi: { uid: 'sr2' }, annotationGroupUID: null },
    { roi: { uid: 'g1-0' }, annotationGroupUID: 'g1' },
    { roi: { uid: 'g2-0' }, annotationGroupUID: 'g2' },
  ]

  it('deduplicates and keeps only visible ROIs and groups', () => {
    expect(
      visibleHoveredFeatures(features, new Set(['sr1']), new Set(['g2'])).map(
        (feature) => feature.roi.uid,
      ),
    ).toEqual(['sr1', 'g2-0'])
  })
})

describe('hoveredFeaturesSignature', () => {
  it('does not depend on order', () => {
    const a = { roi: { uid: 'a' }, annotationGroupUID: null }
    const b = { roi: { uid: 'b' }, annotationGroupUID: 'g' }
    expect(hoveredFeaturesSignature([a, b])).toBe(
      hoveredFeaturesSignature([b, a]),
    )
    expect(hoveredFeaturesSignature([a, b])).toBe('a:|b:g')
  })
})

describe('groupHoveredRoisBySeries', () => {
  it('groups in first-seen order with a fallback name', () => {
    expect(
      groupHoveredRoisBySeries([row(1, 'B'), row(2, ''), row(3, 'B')]).map(
        ([name, rois]) => [name, rois.map((r) => r.index)],
      ),
    ).toEqual([
      ['B', [1, 3]],
      [UNKNOWN_SERIES, [2]],
    ])
  })
})
