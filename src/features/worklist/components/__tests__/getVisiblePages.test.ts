import { getVisiblePages } from '../WorklistPagination'

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

  it('does not insert a gap between adjacent pages', () => {
    expect(getVisiblePages(2, 10)).toEqual([0, 1, 2, 3, null, 9])
  })
})
