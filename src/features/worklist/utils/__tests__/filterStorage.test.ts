import {
  FILTERS_STORAGE_KEY,
  loadStoredFilters,
  parseStoredFilters,
  type StoredFilters,
  saveStoredFilters,
} from '../filterStorage'

describe('parseStoredFilters', () => {
  it('falls back to all dates for missing or invalid input', () => {
    expect(parseStoredFilters(null)).toEqual({ dateFilter: 'all' })
    expect(parseStoredFilters('')).toEqual({ dateFilter: 'all' })
    expect(parseStoredFilters('{oops')).toEqual({ dateFilter: 'all' })
    expect(parseStoredFilters('null')).toEqual({ dateFilter: 'all' })
    expect(parseStoredFilters('{"dateFilter":"year"}')).toEqual({
      dateFilter: 'all',
    })
  })

  it('reads a valid date filter', () => {
    expect(parseStoredFilters('{"dateFilter":"today"}')).toEqual({
      dateFilter: 'today',
    })
    expect(parseStoredFilters('{"dateFilter":"week"}')).toEqual({
      dateFilter: 'week',
    })
  })

  it('drops legacy search text', () => {
    expect(
      parseStoredFilters('{"searchText":"Doe^Jane","dateFilter":"week"}'),
    ).toEqual({ dateFilter: 'week' })
  })
})

describe('loadStoredFilters', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('ignores stored filters when remember is off', () => {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, '{"dateFilter":"today"}')
    expect(loadStoredFilters(window.localStorage, false)).toEqual({
      dateFilter: 'all',
    })
  })

  it('loads stored filters when remember is on', () => {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, '{"dateFilter":"today"}')
    expect(loadStoredFilters(window.localStorage, true)).toEqual({
      dateFilter: 'today',
    })
  })

  it('handles missing or throwing storage', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(loadStoredFilters(undefined, true)).toEqual({ dateFilter: 'all' })
    expect(loadStoredFilters(throwing, true)).toEqual({ dateFilter: 'all' })
  })
})

describe('saveStoredFilters', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists only the date filter', () => {
    const filters = {
      dateFilter: 'week',
      searchText: 'Doe^Jane',
    } as StoredFilters
    saveStoredFilters(window.localStorage, filters, true)
    expect(window.localStorage.getItem(FILTERS_STORAGE_KEY)).toBe(
      '{"dateFilter":"week"}',
    )
  })

  it('removes the key when remember is off', () => {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, '{"dateFilter":"week"}')
    saveStoredFilters(window.localStorage, { dateFilter: 'today' }, false)
    expect(window.localStorage.getItem(FILTERS_STORAGE_KEY)).toBeNull()
  })

  it('does not throw when storage throws', () => {
    const throwing = {
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(() =>
      saveStoredFilters(throwing, { dateFilter: 'week' }, true),
    ).not.toThrow()
    expect(() =>
      saveStoredFilters(throwing, { dateFilter: 'week' }, false),
    ).not.toThrow()
  })
})
