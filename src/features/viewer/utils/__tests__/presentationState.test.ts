import {
  type BlendingItem,
  createInOrderFirstMatch,
  matchBlendingItems,
  referencesSlideSeries,
  upsertBySopInstanceUID,
  windowLimitValues,
} from '../presentationState'

const item = (
  overrides: Partial<BlendingItem> & { id?: string } = {},
): BlendingItem & { id?: string } => ({
  SeriesInstanceUID: 's1',
  ...overrides,
})

describe('referencesSlideSeries', () => {
  it('matches when any blending input belongs to the slide', () => {
    const state = {
      SOPInstanceUID: 'pr',
      AdvancedBlendingSequence: [
        item({ SeriesInstanceUID: 's1' }),
        item({ SeriesInstanceUID: 'other' }),
      ],
    }
    expect(referencesSlideSeries(state, ['s1'])).toBe(true)
    expect(referencesSlideSeries(state, ['nope'])).toBe(false)
  })
})

describe('createInOrderFirstMatch', () => {
  it('reports the first match once every earlier slot settled', () => {
    const onFirst = vi.fn()
    const settle = createInOrderFirstMatch<string>(4, onFirst)

    settle(2, 'c')
    settle(3, 'd')
    expect(onFirst).not.toHaveBeenCalled()
    settle(0)
    expect(onFirst).not.toHaveBeenCalled()
    settle(1)
    expect(onFirst).toHaveBeenCalledOnce()
    expect(onFirst).toHaveBeenCalledWith('c')
  })

  it('reports an early match without waiting for later slots', () => {
    const onFirst = vi.fn()
    const settle = createInOrderFirstMatch<string>(3, onFirst)

    settle(0, 'a')
    settle(1, 'b')
    expect(onFirst).toHaveBeenCalledOnce()
    expect(onFirst).toHaveBeenCalledWith('a')
  })

  it('reports nothing when no slot matches', () => {
    const onFirst = vi.fn()
    const settle = createInOrderFirstMatch<string>(2, onFirst)

    settle(1)
    settle(0)
    expect(onFirst).not.toHaveBeenCalled()
  })
})

describe('matchBlendingItems', () => {
  const opticalPaths = [
    { identifier: 'DAPI', sopInstanceUIDs: ['i1', 'i2'] },
    { identifier: 'FITC', sopInstanceUIDs: ['i3'] },
    { identifier: 'TRITC', sopInstanceUIDs: ['i4'] },
  ]

  it('maps optical paths to the inputs referencing their images', () => {
    const dapi = item({
      id: 'dapi',
      ReferencedInstanceSequence: [{ ReferencedSOPInstanceUID: 'i2' }],
    })
    const fitc = item({
      id: 'fitc',
      ReferencedImageSequence: [{ ReferencedSOPInstanceUID: 'i3' }],
    })
    const matches = matchBlendingItems(opticalPaths, [dapi, fitc])
    expect(matches.get('DAPI')?.id).toBe('dapi')
    expect(matches.get('FITC')?.id).toBe('fitc')
    expect(matches.has('TRITC')).toBe(false)
  })

  it('prefers Referenced Instance Sequence and lets the last match win', () => {
    const first = item({
      id: 'first',
      ReferencedInstanceSequence: [{ ReferencedSOPInstanceUID: 'i1' }],
    })
    const second = item({
      id: 'second',
      ReferencedInstanceSequence: [{ ReferencedSOPInstanceUID: 'i1' }],
      ReferencedImageSequence: [{ ReferencedSOPInstanceUID: 'i4' }],
    })
    const matches = matchBlendingItems(opticalPaths, [first, second])
    expect(matches.get('DAPI')?.id).toBe('second')
    expect(matches.has('TRITC')).toBe(false)
  })
})

describe('windowLimitValues', () => {
  it('converts center/width to limit values', () => {
    expect(
      windowLimitValues(
        item({
          SoftcopyVOILUTSequence: [{ WindowCenter: 100, WindowWidth: 50 }],
        }),
      ),
    ).toEqual([75, 125])
  })

  it('returns undefined without a VOI LUT', () => {
    expect(windowLimitValues(item())).toBeUndefined()
    expect(
      windowLimitValues(item({ SoftcopyVOILUTSequence: [] })),
    ).toBeUndefined()
  })
})

describe('upsertBySopInstanceUID', () => {
  it('appends new instances and replaces listed ones in place', () => {
    const first = { SOPInstanceUID: 'a', version: 1 }
    const second = { SOPInstanceUID: 'b', version: 1 }
    const list = [first, second]

    expect(
      upsertBySopInstanceUID(list, { SOPInstanceUID: 'c', version: 1 }),
    ).toEqual([first, second, { SOPInstanceUID: 'c', version: 1 }])
    expect(
      upsertBySopInstanceUID(list, { SOPInstanceUID: 'a', version: 2 }),
    ).toEqual([{ SOPInstanceUID: 'a', version: 2 }, second])
    expect(list).toEqual([first, second])
  })
})
