import { clampPagination, getPageRange, getVisiblePages } from '../pagination'

describe('clampPagination', () => {
  it('keeps a valid page and returns the same object', () => {
    const pagination = { pageIndex: 1, pageSize: 20 }
    expect(clampPagination(pagination, 30)).toBe(pagination)
  })

  it('moves to the last page when the list shrinks', () => {
    expect(clampPagination({ pageIndex: 4, pageSize: 20 }, 45)).toEqual({
      pageIndex: 2,
      pageSize: 20,
    })
  })
})

describe('getVisiblePages', () => {
  it('lists every page when there are seven or fewer', () => {
    expect(getVisiblePages(0, 1)).toEqual([0])
    expect(getVisiblePages(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('elides pages away from the current one', () => {
    expect(getVisiblePages(0, 20)).toEqual([0, 1, null, 19])
    expect(getVisiblePages(10, 20)).toEqual([0, null, 9, 10, 11, null, 19])
    expect(getVisiblePages(19, 20)).toEqual([0, null, 18, 19])
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

  it('clamps an out-of-range page index', () => {
    expect(getPageRange(10, 20, 45)).toEqual({
      pageCount: 3,
      startItem: 41,
      endItem: 45,
    })
  })
})
