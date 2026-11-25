import {
  formatOpticalPathOptionTitle,
  getOpticalPathStyleSignature,
  type OpticalPathImageLike,
  partitionOpticalPaths,
} from '../opticalPathPartition'

describe('getOpticalPathStyleSignature', () => {
  it('is equal for equal values in different objects', () => {
    expect(
      getOpticalPathStyleSignature({
        opacity: 1,
        color: [255, 0, 0],
        limitValues: [0, 255],
      }),
    ).toBe(
      getOpticalPathStyleSignature({
        opacity: 1,
        color: [255, 0, 0],
        limitValues: [0, 255],
      }),
    )
  })

  it('changes with opacity, color or limits', () => {
    const base = getOpticalPathStyleSignature({ opacity: 1, color: [1, 2, 3] })
    expect(
      getOpticalPathStyleSignature({ opacity: 0.5, color: [1, 2, 3] }),
    ).not.toBe(base)
    expect(
      getOpticalPathStyleSignature({ opacity: 1, color: [1, 2, 4] }),
    ).not.toBe(base)
    expect(
      getOpticalPathStyleSignature({
        opacity: 1,
        color: [1, 2, 3],
        limitValues: [0, 10],
      }),
    ).not.toBe(base)
  })

  it('treats missing color and limits alike', () => {
    expect(getOpticalPathStyleSignature({ opacity: 1 })).toBe(
      getOpticalPathStyleSignature({
        opacity: 1,
        color: undefined,
        limitValues: undefined,
      }),
    )
  })
})

const image = (
  seriesInstanceUID: string,
  items: Array<[string, string?]>,
): OpticalPathImageLike => ({
  SeriesInstanceUID: seriesInstanceUID,
  OpticalPathSequence: items.map(([id, description]) => ({
    OpticalPathIdentifier: id,
    OpticalPathDescription: description,
  })),
})

describe('formatOpticalPathOptionTitle', () => {
  it('joins identifier and description', () => {
    expect(formatOpticalPathOptionTitle('1', 'DAPI')).toBe('1 - DAPI')
  })

  it('falls back to the identifier', () => {
    expect(formatOpticalPathOptionTitle('1', '')).toBe('1')
    expect(formatOpticalPathOptionTitle('1', undefined)).toBe('1')
  })
})

describe('partitionOpticalPaths', () => {
  const shared = image('1.2.3', [
    ['1', 'DAPI'],
    ['2', 'FITC'],
    ['3', ''],
  ])
  const paths = [{ identifier: '1' }, { identifier: '2' }, { identifier: '3' }]
  const metadata = { '1': [shared], '2': [shared], '3': [shared] }

  it('splits active and available paths in input order', () => {
    const { active, available } = partitionOpticalPaths(
      paths,
      metadata,
      new Set(['2']),
    )
    expect(active).toEqual([
      { key: '1.2.3-2', opticalPath: paths[1], images: [shared] },
    ])
    expect(available).toEqual([
      { id: '1', title: '1 - DAPI' },
      { id: '3', title: '3' },
    ])
  })

  it('skips paths without metadata instead of throwing', () => {
    const result = partitionOpticalPaths(
      [{ identifier: 'missing' }, { identifier: 'empty' }],
      { empty: [] },
      new Set(['missing', 'empty']),
    )
    expect(result).toEqual({ active: [], available: [] })
  })

  it('skips paths absent from the Optical Path Sequence', () => {
    const result = partitionOpticalPaths(
      [{ identifier: '9' }],
      { '9': [image('1.2.3', [['1']])] },
      new Set(),
    )
    expect(result).toEqual({ active: [], available: [] })
  })

  it('tolerates images without an Optical Path Sequence', () => {
    const result = partitionOpticalPaths(
      [{ identifier: '1' }],
      { '1': [{ SeriesInstanceUID: '1.2.3' }] },
      new Set(['1']),
    )
    expect(result.active).toEqual([])
  })
})
