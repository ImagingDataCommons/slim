import { act, renderHook, waitFor } from '@testing-library/react'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import { StorageClasses } from '../../../../data/uids'
import {
  type ContainsEntry,
  findContainsEntry,
} from '../../utils/containsCatalog'
import {
  CONTAINS_MAX_PAGES,
  CONTAINS_PAGE_SIZE,
  type ContainsSearchClient,
} from '../../utils/containsSearch'
import {
  type ContainsCandidate,
  UNKNOWN_ROW_CHECK_TTL_MS,
  useContainsRowChecks,
  useContainsSearch,
} from '../useContainsSearch'

const entry = (id: string): ContainsEntry => {
  const found = findContainsEntry(id)
  if (found === undefined) throw new Error(`No entry ${id}`)
  return found
}

type QidoRow = dwc.api.Instance & dwc.api.Series

const offsetOf = (
  options: dwc.api.SearchForSeriesOptions | dwc.api.SearchForInstancesOptions,
): number =>
  Number((options.queryParams as { offset?: number } | undefined)?.offset)

function row(
  studyUid: string,
  seriesUid: string,
  sopClassUid: string,
): QidoRow {
  return {
    '0020000D': { vr: 'UI', Value: [studyUid] },
    '0020000E': { vr: 'UI', Value: [seriesUid] },
    '00080016': { vr: 'UI', Value: [sopClassUid] },
  } as unknown as QidoRow
}

function fakeClient(
  pages: ReadonlyMap<number, QidoRow[]>,
): ContainsSearchClient {
  const search = async (
    options: dwc.api.SearchForSeriesOptions | dwc.api.SearchForInstancesOptions,
  ): Promise<QidoRow[]> => pages.get(offsetOf(options)) ?? []
  return { searchForSeries: search, searchForInstances: search }
}

describe('useContainsSearch', () => {
  it('loads one page and appends the next when asked', async () => {
    const pmap = StorageClasses.PARAMETRIC_MAP
    const client = fakeClient(new Map())
    client.searchForInstances = vi.fn(
      async (
        options: dwc.api.SearchForInstancesOptions,
      ): Promise<QidoRow[]> => {
        const offset = offsetOf(options)
        if (offset === 0) {
          return Array.from({ length: CONTAINS_PAGE_SIZE }, (_, index) =>
            row(`s${index}`, `a${index}`, pmap),
          )
        }
        return [row('later', 'z', pmap)]
      },
    )

    const { result } = renderHook(() =>
      useContainsSearch(client, entry('pmap')),
    )

    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(result.current.result?.matches.size).toBe(CONTAINS_PAGE_SIZE)
    expect(result.current.canLoadMore).toBe(true)
    expect(client.searchForInstances).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.loadMore()
    })
    await waitFor(() => {
      expect(result.current.result?.matches.has('later')).toBe(true)
      expect(result.current.result?.isPartial).toBe(false)
      expect(result.current.status).toBe('done')
    })
    expect(result.current.canLoadMore).toBe(false)
    expect(client.searchForInstances).toHaveBeenCalledTimes(2)
  })

  it('stops offering more pages at the session cap', async () => {
    const pmap = StorageClasses.PARAMETRIC_MAP
    const fullPage = (offset: number): QidoRow[] =>
      Array.from({ length: CONTAINS_PAGE_SIZE }, (_, index) =>
        row(`s${offset + index}`, `x${offset + index}`, pmap),
      )
    const client = fakeClient(new Map())
    client.searchForInstances = vi.fn(
      async (options: dwc.api.SearchForInstancesOptions): Promise<QidoRow[]> =>
        fullPage(offsetOf(options)),
    )

    const { result } = renderHook(() =>
      useContainsSearch(client, entry('pmap')),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })

    for (let page = 1; page < CONTAINS_MAX_PAGES; page++) {
      act(() => {
        result.current.loadMore()
      })
      await waitFor(() => {
        expect(result.current.pages).toBe(page + 1)
      })
    }

    expect(result.current.canLoadMore).toBe(false)
    expect(client.searchForInstances).toHaveBeenCalledTimes(CONTAINS_MAX_PAGES)
    act(() => {
      result.current.loadMore()
    })
    expect(client.searchForInstances).toHaveBeenCalledTimes(CONTAINS_MAX_PAGES)
  })

  it('does not carry a Search more click over to another cached entry', async () => {
    const fullPage = (sopClassUid: string, offset: number): QidoRow[] =>
      Array.from({ length: CONTAINS_PAGE_SIZE }, (_, index) =>
        row(`${sopClassUid}-${offset + index}`, `x${index}`, sopClassUid),
      )
    const client = fakeClient(new Map())
    client.searchForInstances = vi.fn(
      async (
        options: dwc.api.SearchForInstancesOptions,
      ): Promise<QidoRow[]> => {
        const { SOPClassUID } = options.queryParams as { SOPClassUID: string }
        return fullPage(SOPClassUID, offsetOf(options))
      },
    )
    const { result, rerender } = renderHook(
      ({ current }: { current: ContainsEntry }) =>
        useContainsSearch(client, current),
      { initialProps: { current: entry('seg') } },
    )
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })

    rerender({ current: entry('pmap') })
    await waitFor(() => {
      expect(result.current.pages).toBe(1)
    })
    act(() => {
      result.current.loadMore()
    })
    await waitFor(() => {
      expect(result.current.pages).toBe(2)
    })
    expect(client.searchForInstances).toHaveBeenCalledTimes(3)

    rerender({ current: entry('seg') })
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(result.current.pages).toBe(1)
    expect(client.searchForInstances).toHaveBeenCalledTimes(3)

    /** Coming back shows the pages already loaded without fetching again */
    rerender({ current: entry('pmap') })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(result.current.status).toBe('done')
    expect(result.current.pages).toBe(2)
    expect(client.searchForInstances).toHaveBeenCalledTimes(3)
  })
})

describe('useContainsSearch across stores', () => {
  it('reports a store that keeps failing and stops offering it at the cap', async () => {
    const seg = StorageClasses.SEGMENTATION
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const healthy = fakeClient(new Map([[0, [row('s1', 'a', seg)]]]))
    const broken = fakeClient(new Map())
    broken.searchForInstances = vi.fn(async (): Promise<QidoRow[]> => {
      throw Object.assign(new Error('down'), { status: 503 })
    })
    const combined = {
      ...fakeClient(new Map()),
      storeSearchClients: () => [healthy, broken],
    }

    const { result } = renderHook(() =>
      useContainsSearch(combined, entry('seg')),
    )
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(result.current.result?.hasStoreFailures).toBe(true)
    expect(result.current.canLoadMore).toBe(true)

    for (let page = 1; page < CONTAINS_MAX_PAGES; page++) {
      act(() => {
        result.current.loadMore()
      })
      await waitFor(() => {
        expect(result.current.pages).toBe(page + 1)
      })
    }

    expect(result.current.canLoadMore).toBe(false)
    expect(result.current.result?.hasStoreFailures).toBe(true)
    expect([...(result.current.result?.matches.keys() ?? [])]).toEqual(['s1'])
    logError.mockRestore()
  })
})

describe('useContainsRowChecks', () => {
  it('checks a row again once an unknown verdict is stale', async () => {
    const seg = StorageClasses.SEGMENTATION
    let isDown = true
    const client = fakeClient(new Map())
    client.searchForInstances = vi.fn(async (): Promise<QidoRow[]> => {
      if (isDown) throw Object.assign(new Error('down'), { status: 503 })
      return [row('s1', 'a', seg)]
    })
    const studyClient = { searchForStudies: vi.fn(async () => []) }
    const candidate: ContainsCandidate = {
      studyUid: 's1',
      seriesUids: ['a'],
      needsStudy: false,
      needsSopClass: true,
    }
    const { result, rerender } = renderHook(
      ({ candidates }: { candidates: ContainsCandidate[] }) =>
        useContainsRowChecks(client, studyClient, entry('seg'), candidates),
      { initialProps: { candidates: [candidate] } },
    )
    await waitFor(() => {
      expect(result.current('s1')).toEqual({ status: 'unknown' })
    })

    isDown = false
    const later = Date.now() + UNKNOWN_ROW_CHECK_TTL_MS + 1
    vi.spyOn(Date, 'now').mockReturnValue(later)
    rerender({ candidates: [{ ...candidate }] })

    await waitFor(() => {
      expect(result.current('s1')).toEqual({ status: 'match' })
    })
    vi.restoreAllMocks()
  })

  it('shows a row as checking again while Retry re-checks it', async () => {
    const seg = StorageClasses.SEGMENTATION
    let isDown = true
    let release: (() => void) | undefined
    const client = fakeClient(new Map())
    client.searchForInstances = vi.fn(
      async (
        options: dwc.api.SearchForInstancesOptions,
      ): Promise<QidoRow[]> => {
        if (options.studyInstanceUID === undefined) return []
        if (isDown) throw Object.assign(new Error('down'), { status: 503 })
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return [row('s1', 'a', seg)]
      },
    )
    const studyClient = { searchForStudies: vi.fn(async () => []) }
    const candidate: ContainsCandidate = {
      studyUid: 's1',
      seriesUids: ['a'],
      needsStudy: false,
      needsSopClass: true,
    }
    const { result, rerender } = renderHook(
      ({ candidates }: { candidates: ContainsCandidate[] }) => ({
        search: useContainsSearch(client, entry('seg')),
        getCheck: useContainsRowChecks(
          client,
          studyClient,
          entry('seg'),
          candidates,
        ),
      }),
      { initialProps: { candidates: [candidate] } },
    )
    await waitFor(() => {
      expect(result.current.getCheck('s1')).toEqual({ status: 'unknown' })
    })

    isDown = false
    act(() => {
      result.current.search.retry()
    })
    rerender({ candidates: [{ ...candidate }] })
    expect(result.current.getCheck('s1')).toEqual({ status: 'checking' })

    await waitFor(() => expect(release).toBeDefined())
    await act(async () => {
      release?.()
    })
    await waitFor(() => {
      expect(result.current.getCheck('s1')).toEqual({ status: 'match' })
    })
  })
})
