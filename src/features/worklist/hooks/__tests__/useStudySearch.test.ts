import { renderHook, waitFor } from '@testing-library/react'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import DicomWebManager from '../../../../DicomWebManager'
import { StorageClasses } from '../../../../data/uids'
import { useStudySearch } from '../useStudySearch'

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
})
