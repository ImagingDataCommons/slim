import { renderHook, waitFor } from '@testing-library/react'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import DicomWebManager from '../../../../DicomWebManager'
import { StorageClasses } from '../../../../data/uids'
import { useStudySearch } from '../useStudySearch'

vi.mock('dicom-microscopy-viewer', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('dicom-microscopy-viewer')>()
  return {
    ...actual,
    metadata: {
      ...actual.metadata,
      formatMetadata: (dataset: object) => {
        if ('unformattable' in dataset) throw new Error('cannot format')
        return actual.metadata.formatMetadata(
          dataset as Parameters<typeof actual.metadata.formatMetadata>[0],
        )
      },
    },
  }
})

type Clients = { [key: string]: DicomWebManager }
type QueryParams = Record<string, unknown>

function studyJson(uid: string, patientId: string): dwc.api.Study {
  return {
    '0020000D': { vr: 'UI', Value: [uid] },
    '00100020': { vr: 'LO', Value: [patientId] },
    '00100010': { vr: 'PN' },
  } as dwc.api.Study
}

function createClients(
  searchForStudies: (params: QueryParams) => Promise<dwc.api.Study[]>,
): Clients {
  const manager = new DicomWebManager({
    baseUri: 'http://mockserver.org',
    settings: [{ id: 'mock', path: '/dicomweb', write: false }],
  })
  manager.searchForStudies = async (options) =>
    await searchForStudies((options.queryParams ?? {}) as QueryParams)
  return { [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: manager }
}

describe('useStudySearch', () => {
  it('stays idle for blank text', () => {
    const search = vi.fn(
      async (_params: QueryParams): Promise<dwc.api.Study[]> => [],
    )
    const { result } = renderHook(() =>
      useStudySearch({ clients: createClients(search), searchText: '  ' }),
    )
    expect(result.current).toEqual({
      matches: [],
      isSearching: false,
      hasError: false,
    })
    expect(search).not.toHaveBeenCalled()
  })

  it('skips the server for a one-character term', () => {
    const search = vi.fn(
      async (_params: QueryParams): Promise<dwc.api.Study[]> => [],
    )
    const { result } = renderHook(() =>
      useStudySearch({ clients: createClients(search), searchText: 'P' }),
    )
    expect(result.current).toEqual({
      matches: [],
      isSearching: false,
      hasError: false,
    })
    expect(search).not.toHaveBeenCalled()
  })

  it('merges the matches of every query, once per study', async () => {
    const clients = createClients(async (params) => {
      if (params.PatientID === 'P-9') return [studyJson('9.9', 'P-9')]
      if (params.PatientName === 'P-9') return [studyJson('9.9', 'P-9')]
      if (params.StudyID !== undefined) {
        throw Object.assign(new Error('400'), { status: 400 })
      }
      return []
    })
    const { result } = renderHook(() =>
      useStudySearch({ clients, searchText: 'P-9' }),
    )

    expect(result.current.isSearching).toBe(true)
    await waitFor(() => expect(result.current.isSearching).toBe(false))
    expect(result.current.hasError).toBe(false)
    expect(result.current.matches.map((study) => study.PatientID)).toEqual([
      'P-9',
    ])
  })

  it('reports an error when a non-rejected query fails', async () => {
    const clients = createClients(async (params) => {
      if (params.StudyID !== undefined) {
        throw Object.assign(new Error('down'), { status: 503 })
      }
      return []
    })
    const { result } = renderHook(() =>
      useStudySearch({ clients, searchText: 'P-9' }),
    )

    await waitFor(() => expect(result.current.isSearching).toBe(false))
    expect(result.current).toEqual({
      matches: [],
      isSearching: false,
      hasError: true,
    })
  })

  it('reports an error instead of hanging when a row cannot be formatted', async () => {
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const clients = createClients(
      async () => [{ unformattable: true }] as unknown as dwc.api.Study[],
    )
    const { result } = renderHook(() =>
      useStudySearch({ clients, searchText: 'P-9' }),
    )

    await waitFor(() => expect(result.current.isSearching).toBe(false))
    expect(result.current.hasError).toBe(true)
    logError.mockRestore()
  })

  it("never shows the previous server's matches for the new one", async () => {
    const oldClients = createClients(async () => [studyJson('1.1', 'P-1')])
    const newClients = createClients(
      () => new Promise<dwc.api.Study[]>(() => undefined),
    )
    const renders: Array<{ clients: Clients; count: number }> = []
    const { result, rerender } = renderHook(
      ({ clients }: { clients: Clients }) => {
        const value = useStudySearch({ clients, searchText: 'P-1' })
        renders.push({ clients, count: value.matches.length })
        return value
      },
      { initialProps: { clients: oldClients } },
    )
    await waitFor(() => expect(result.current.matches).toHaveLength(1))

    rerender({ clients: newClients })

    const afterSwitch = renders.filter(
      (render) => render.clients === newClients,
    )
    expect(afterSwitch.length).toBeGreaterThan(0)
    for (const render of afterSwitch) expect(render.count).toBe(0)
  })

  it('only queries for the text once typing pauses', async () => {
    const search = vi.fn(
      async (_params: QueryParams): Promise<dwc.api.Study[]> => [],
    )
    const clients = createClients(search)
    const { result, rerender } = renderHook(
      ({ searchText }: { searchText: string }) =>
        useStudySearch({ clients, searchText }),
      { initialProps: { searchText: 'P' } },
    )
    rerender({ searchText: 'P-9' })

    await waitFor(() => expect(result.current.isSearching).toBe(false))
    const searched = search.mock.calls.map(([params]) => params.PatientID)
    expect(searched).not.toContain('P')
    expect(searched).toContain('P-9')
    expect(search.mock.calls[0]?.[0].limit).toBe(100)
  })

  it('sends the wildcard queries only when the exact ones find nothing', async () => {
    const search = vi.fn(async (params: QueryParams) =>
      params.PatientID === '*P-9*' ? [studyJson('9.9', 'P-90')] : [],
    )
    const clients = createClients(search)
    const { result } = renderHook(() =>
      useStudySearch({ clients, searchText: 'P-9' }),
    )

    await waitFor(() => expect(result.current.isSearching).toBe(false))
    expect(result.current.matches.map((study) => study.PatientID)).toEqual([
      'P-90',
    ])
    expect(search).toHaveBeenCalledTimes(7)
  })

  it('skips the wildcard queries once the exact ones match', async () => {
    const search = vi.fn(async (params: QueryParams) =>
      params.PatientID === 'P-9' ? [studyJson('9.9', 'P-9')] : [],
    )
    const clients = createClients(search)
    const { result } = renderHook(() =>
      useStudySearch({ clients, searchText: 'P-9' }),
    )

    await waitFor(() => expect(result.current.isSearching).toBe(false))
    expect(result.current.matches).toHaveLength(1)
    expect(search).toHaveBeenCalledTimes(4)
  })
})
