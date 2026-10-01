import {
  readFromStorage,
  removeFromStorage,
  writeToStorage,
} from '../../../utils/safeStorage'
import type { DateFilter } from './filters'

export const FILTERS_STORAGE_KEY = 'slim-worklist-filters'

/**
 * Worklist filters kept between sessions. Free-text search is deliberately
 * excluded: it routinely holds patient names and IDs.
 */
export interface StoredFilters {
  dateFilter: DateFilter
}

export const DEFAULT_STORED_FILTERS: StoredFilters = { dateFilter: 'all' }

function isDateFilter(value: unknown): value is DateFilter {
  return value === 'all' || value === 'today' || value === 'week'
}

export function parseStoredFilters(raw: string | null): StoredFilters {
  if (raw === null || raw === '') return { ...DEFAULT_STORED_FILTERS }
  try {
    const parsed = JSON.parse(raw) as { dateFilter?: unknown } | null
    const dateFilter = parsed?.dateFilter
    return {
      dateFilter: isDateFilter(dateFilter)
        ? dateFilter
        : DEFAULT_STORED_FILTERS.dateFilter,
    }
  } catch {
    return { ...DEFAULT_STORED_FILTERS }
  }
}

export function loadStoredFilters(
  storage: Storage | undefined,
  remember: boolean,
): StoredFilters {
  if (!remember) return { ...DEFAULT_STORED_FILTERS }
  return parseStoredFilters(readFromStorage(storage, FILTERS_STORAGE_KEY))
}

export function saveStoredFilters(
  storage: Storage | undefined,
  filters: StoredFilters,
  remember: boolean,
): void {
  if (!remember) {
    removeFromStorage(storage, FILTERS_STORAGE_KEY)
    return
  }
  const stored: StoredFilters = { dateFilter: filters.dateFilter }
  writeToStorage(storage, FILTERS_STORAGE_KEY, JSON.stringify(stored))
}
