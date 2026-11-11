import { columns } from '../columns'

describe('worklist columns', () => {
  it('names a comparator for every sortable column', () => {
    const unnamed = columns
      .filter((column) => column.enableSorting !== false)
      .filter((column) => typeof column.sortingFn !== 'string')
      .map((column) => column.id)
    expect(unnamed).toEqual([])
  })
})
