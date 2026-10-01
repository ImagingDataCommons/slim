import {
  buildTagTree,
  collectExpandableKeys,
  countRows,
  filterTagTree,
  getInstanceDimensions,
  getSeriesLabel,
  sortInstancesByNumber,
  sortSeriesByNumber,
  type TagInfo,
  type TagTreeNode,
} from '../dicomTagUtils'

const tags: TagInfo[] = [
  {
    tag: '(0008,0060)',
    vr: 'CS',
    keyword: 'Modality',
    value: 'SM',
    level: 0,
  },
  {
    tag: '(0040,0560)',
    vr: 'SQ',
    keyword: 'SpecimenDescriptionSequence',
    value: 'Sequence with 1 item(s)',
    level: 0,
    children: [
      {
        tag: '(0040,0560).1',
        vr: 'Item',
        keyword: 'Item 1',
        value: 'Sequence Item 1',
        level: 1,
        children: [
          {
            tag: '(0040,0551)',
            vr: 'LO',
            keyword: 'SpecimenIdentifier',
            value: 'S-42',
            level: 2,
          },
          {
            tag: '(0040,0554)',
            vr: 'UI',
            keyword: 'SpecimenUID',
            value: '1.2.3',
            level: 2,
          },
        ],
      },
    ],
  },
]

describe('buildTagTree', () => {
  it('derives keys from the tag path', () => {
    const tree = buildTagTree(tags)
    expect(tree[0].key).toBe('00080060')
    expect(tree[1].children?.[0].key).toBe('00400560-00400560.1')
    expect(tree[1].children?.[0].children?.[0].key).toBe(
      '00400560-00400560.1-00400551',
    )
  })

  it('falls back to the index for empty tags', () => {
    expect(
      buildTagTree([{ tag: '', vr: '', keyword: 'x', value: '', level: 0 }])[0]
        .key,
    ).toBe('0')
  })
})

describe('filterTagTree', () => {
  const tree = buildTagTree(tags)

  it('returns the tree unchanged for an empty query', () => {
    const result = filterTagTree(tree, '  ')
    expect(result.tree).toBe(tree)
    expect(result.matchedKeys.size).toBe(0)
  })

  it('keeps ancestors of nested matches and reports them as expanded', () => {
    const { tree: filtered, matchedKeys } = filterTagTree(tree, 's-42')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].keyword).toBe('SpecimenDescriptionSequence')
    const item = filtered[0].children?.[0]
    expect(item?.children?.map((node) => node.keyword)).toEqual([
      'SpecimenIdentifier',
    ])
    expect([...matchedKeys]).toEqual([
      '00400560-00400560.1-00400551',
      '00400560-00400560.1',
      '00400560',
    ])
  })

  it('keeps all children of a matching sequence', () => {
    const { tree: filtered } = filterTagTree(tree, 'specimendescription')
    expect(filtered[0].children?.[0].children).toHaveLength(2)
  })

  it('matches on VR and returns nothing when nothing matches', () => {
    expect(filterTagTree(tree, 'cs').tree.map((node) => node.keyword)).toEqual([
      'Modality',
    ])
    expect(filterTagTree(tree, 'zzz').tree).toEqual([])
  })
})

describe('collectExpandableKeys / countRows', () => {
  const tree: TagTreeNode[] = buildTagTree(tags)

  it('lists every node with children', () => {
    expect(collectExpandableKeys(tree)).toEqual([
      '00400560',
      '00400560-00400560.1',
    ])
  })

  it('counts rows for the expanded state', () => {
    expect(countRows(tree, new Set())).toBe(2)
    expect(countRows(tree, new Set(['00400560']))).toBe(3)
    expect(countRows(tree, new Set(collectExpandableKeys(tree)))).toBe(5)
  })
})

describe('sortInstancesByNumber', () => {
  it('sorts numerically and puts missing numbers last', () => {
    const sorted = sortInstancesByNumber([
      { id: 'c', InstanceNumber: 10 },
      { id: 'x' },
      { id: 'a', InstanceNumber: '2' },
      { id: 'b', InstanceNumber: 3 },
    ])
    expect(sorted.map((item) => item.id)).toEqual(['a', 'b', 'c', 'x'])
  })

  it('does not mutate the input', () => {
    const input = [{ InstanceNumber: 2 }, { InstanceNumber: 1 }]
    sortInstancesByNumber(input)
    expect(input[0].InstanceNumber).toBe(2)
  })
})

describe('getInstanceDimensions', () => {
  it('prefers the total pixel matrix', () => {
    expect(
      getInstanceDimensions({
        TotalPixelMatrixColumns: 98304,
        TotalPixelMatrixRows: '65536',
        Columns: 256,
        Rows: 256,
      }),
    ).toEqual({ columns: 98304, rows: 65536 })
  })

  it('falls back to Rows/Columns and drops invalid values', () => {
    expect(getInstanceDimensions({ Columns: 512 })).toEqual({
      columns: 512,
      rows: undefined,
    })
    expect(getInstanceDimensions(undefined)).toBeUndefined()
  })
})

describe('sortSeriesByNumber / getSeriesLabel', () => {
  it('sorts series numerically with blanks last', () => {
    expect(
      sortSeriesByNumber([
        { SeriesNumber: '' },
        { SeriesNumber: '10' },
        { SeriesNumber: 'abc' },
        { SeriesNumber: '2' },
      ]).map((series) => series.SeriesNumber),
    ).toEqual(['2', '10', '', 'abc'])
  })

  it('builds the series label and date description', () => {
    const { label, description } = getSeriesLabel({
      SeriesNumber: '3',
      Modality: 'SM',
      SeriesDescription: 'Slide 1',
      SeriesDate: '20240115',
      SeriesTime: '101500.123',
    })
    expect(label).toBe('3 (SM): Slide 1')
    expect(description).not.toBe('')
  })
})
