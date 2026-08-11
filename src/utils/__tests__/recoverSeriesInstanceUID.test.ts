import {
  findSlideBySeriesInstanceUID,
  recoverSeriesInstanceUID,
  seriesUidFromSlide,
} from '../recoverSeriesInstanceUID'

describe('recoverSeriesInstanceUID', () => {
  const uids = [
    '1.2.3.4.5.6.7.8.9.2',
    '1.2.3.4.5.6.7.8.9.2.0',
    '1.2.3.4.5.6.7.8.9.2.0.1',
  ]

  it('returns an exact match', () => {
    expect(recoverSeriesInstanceUID(uids[1], uids)).toBe(uids[1])
  })

  it('strips trailing .0 from antd Menu key mangling', () => {
    expect(recoverSeriesInstanceUID(`${uids[2]}.0`, uids)).toBe(uids[2])
  })

  it('stops stripping at the first existing UID', () => {
    // "...2.0.0" → "...2.0" exists in candidates, do not strip further to "...2"
    expect(recoverSeriesInstanceUID(`${uids[0]}.0.0`, uids)).toBe(uids[1])
  })

  it('strips multiple trailing .0 when intermediates are absent', () => {
    expect(recoverSeriesInstanceUID(`${uids[0]}.0.0`, [uids[0]])).toBe(uids[0])
  })

  it('prefers the longest prefix when strip does not match', () => {
    expect(
      recoverSeriesInstanceUID('1.2.3.4.5.6.7.8.9.2.0.1.9', uids),
    ).toBe(uids[2])
  })

  it('returns undefined when nothing matches', () => {
    expect(recoverSeriesInstanceUID('9.9.9', uids)).toBeUndefined()
  })
})

describe('findSlideBySeriesInstanceUID', () => {
  const slides = [
    { id: 'a', seriesInstanceUIDs: ['1.2.3.2', '1.2.3.2.0'] },
    { id: 'b', seriesInstanceUIDs: ['1.2.3.2.0.1'] },
  ]

  it('finds an exact slide', () => {
    expect(findSlideBySeriesInstanceUID(slides, '1.2.3.2.0.1')?.id).toBe('b')
  })

  it('does not bind a mangled longer UID to a shorter sibling prefix', () => {
    expect(findSlideBySeriesInstanceUID(slides, '1.2.3.2.0.1.0')?.id).toBe('b')
  })
})

describe('seriesUidFromSlide', () => {
  const slide = {
    seriesInstanceUIDs: ['1.2.3.2', '1.2.3.2.0.1'],
  }

  it('recovers a mangled preferred UID', () => {
    expect(seriesUidFromSlide(slide, '1.2.3.2.0.1.0')).toBe('1.2.3.2.0.1')
  })

  it('falls back to the first UID', () => {
    expect(seriesUidFromSlide(slide)).toBe('1.2.3.2')
  })
})
