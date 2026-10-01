import { clampPageIndex, getPageRange, getVisiblePages } from '../pagination'

describe('getVisiblePages', () => {
  it('lists every page when there are seven or fewer', () => {
    expect(getVisiblePages(0, 1)).toEqual([0])
    expect(getVisiblePages(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('returns no pages when there are none', () => {
    expect(getVisiblePages(0, 0)).toEqual([])
  })

  it('elides pages away from the current one', () => {
    expect(getVisiblePages(0, 20)).toEqual([0, 1, null, 19])
    expect(getVisiblePages(10, 20)).toEqual([0, null, 9, 10, 11, null, 19])
    expect(getVisiblePages(19, 20)).toEqual([0, null, 18, 19])
  })

  it('does not insert a gap between adjacent pages', () => {
    expect(getVisiblePages(2, 10)).toEqual([0, 1, 2, 3, null, 9])
    expect(getVisiblePages(7, 10)).toEqual([0, null, 6, 7, 8, 9])
  })
})

describe('clampPageIndex', () => {
  it('keeps the index within the available pages', () => {
    expect(clampPageIndex(-1, 5)).toBe(0)
    expect(clampPageIndex(2, 5)).toBe(2)
    expect(clampPageIndex(9, 5)).toBe(4)
  })

  it('returns 0 when there are no pages', () => {
    expect(clampPageIndex(3, 0)).toBe(0)
  })
})

describe('getPageRange', () => {
  it('describes an empty list', () => {
    expect(getPageRange(0, 20, 0)).toEqual({
      pageCount: 1,
      startItem: 0,
      endItem: 0,
    })
  })

  it('describes full and partial pages', () => {
    expect(getPageRange(0, 20, 45)).toEqual({
      pageCount: 3,
      startItem: 1,
      endItem: 20,
    })
    expect(getPageRange(2, 20, 45)).toEqual({
      pageCount: 3,
      startItem: 41,
      endItem: 45,
    })
  })

  it('clamps an out-of-range page index', () => {
    expect(getPageRange(10, 20, 45)).toEqual({
      pageCount: 3,
      startItem: 41,
      endItem: 45,
    })
  })

  it('handles an exact multiple of the page size', () => {
    expect(getPageRange(1, 20, 40)).toEqual({
      pageCount: 2,
      startItem: 21,
      endItem: 40,
    })
  })
})
