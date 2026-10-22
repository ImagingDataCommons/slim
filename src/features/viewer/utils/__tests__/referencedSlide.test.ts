import {
  isReferencingInstance,
  type ReferencingInstance,
  resolveReferencedSlide,
} from '../referencedSlide'

describe('isReferencingInstance', () => {
  it('accepts datasets with series and SOP instance UIDs', () => {
    expect(
      isReferencingInstance({ SeriesInstanceUID: 's', SOPInstanceUID: 'i' }),
    ).toBe(true)
  })

  it('rejects datasets missing or mistyping either UID', () => {
    expect(isReferencingInstance({})).toBe(false)
    expect(isReferencingInstance({ SeriesInstanceUID: 's' })).toBe(false)
    expect(
      isReferencingInstance({ SeriesInstanceUID: 's', SOPInstanceUID: 1 }),
    ).toBe(false)
  })
})

const slides = [
  {
    id: 'slide-a',
    seriesInstanceUIDs: ['sa'],
    volumeImages: [{ SOPInstanceUID: 'ia1' }],
  },
  {
    id: 'slide-b',
    seriesInstanceUIDs: ['sb1', 'sb2'],
    volumeImages: [{ SOPInstanceUID: 'ib1' }, { SOPInstanceUID: 'ib2' }],
  },
]

const base: ReferencingInstance = {
  SeriesInstanceUID: 'derived',
  SOPInstanceUID: 'd1',
}

function imageLibrary(sopInstanceUID: string): ReferencingInstance {
  return {
    ...base,
    ContentSequence: [
      { ConceptNameCodeSequence: [{ CodeValue: '121058' }] },
      {
        ConceptNameCodeSequence: [{ CodeValue: '111028' }],
        ContentSequence: [
          {
            ContentSequence: [
              {
                ReferencedSOPSequence: [
                  { ReferencedSOPInstanceUID: sopInstanceUID },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('resolveReferencedSlide', () => {
  it('follows the Referenced Series Sequence', () => {
    expect(
      resolveReferencedSlide(slides, {
        ...base,
        ReferencedSeriesSequence: [
          { SeriesInstanceUID: 'unknown' },
          { SeriesInstanceUID: 'sb2' },
        ],
      })?.id,
    ).toBe('slide-b')
  })

  it('falls back to the SR image library', () => {
    expect(resolveReferencedSlide(slides, imageLibrary('ib2'))?.id).toBe(
      'slide-b',
    )
    expect(
      resolveReferencedSlide(slides, {
        ...imageLibrary('ia1'),
        ReferencedSeriesSequence: [{ SeriesInstanceUID: 'unknown' }],
      })?.id,
    ).toBe('slide-a')
  })

  it('returns undefined when nothing matches', () => {
    expect(resolveReferencedSlide(slides, base)).toBeUndefined()
    expect(resolveReferencedSlide(slides, imageLibrary('nope'))).toBeUndefined()
    expect(
      resolveReferencedSlide(slides, {
        ...base,
        ContentSequence: [
          { ConceptNameCodeSequence: [{ CodeValue: '111028' }] },
        ],
      }),
    ).toBeUndefined()
  })
})
