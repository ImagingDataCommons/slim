import { act, renderHook, waitFor } from '@testing-library/react'
// skipcq: JS-C1003
import type * as dwc from 'dicomweb-client'

import DicomWebManager from '../../../../DicomWebManager'
import { StorageClasses } from '../../../../data/uids'
import NotificationMiddleware from '../../../../services/NotificationMiddleware'
import { useStudies } from '../useStudies'

type Clients = { [key: string]: DicomWebManager }

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function element(
  vr: string,
  Value?: string[] | number[],
): dwc.api.MetadataElement {
  return Value === undefined ? { vr } : { vr, Value }
}

function studyJson(uid: string, modalities?: string[]): dwc.api.Study {
  return {
    '0020000D': element('UI', [uid]),
    '00200010': element('SH'),
    '00080020': element('DA', ['20260901']),
    '00080030': element('TM'),
    '00080050': element('SH'),
    '00100020': element('LO'),
    '00100030': element('DA'),
    '00100040': element('CS'),
    '00100010': element('PN'),
    '00080061': element('CS', modalities),
    '00201206': element('IS', [1]),
    '00201208': element('IS', [1]),
  }
}

function seriesJson(modality: string): dwc.api.Series {
  return {
    '0020000E': element('UI', [`series-${modality}`]),
    '00200011': element('IS', [1]),
    '00080060': element('CS', [modality]),
    '00201209': element('IS', [1]),
  }
}

function createClients(
  searchForStudies: DicomWebManager['searchForStudies'],
  searchForSeries: DicomWebManager['searchForSeries'] = async () => [],
): Clients {
  const manager = new DicomWebManager({
    baseUri: 'http://mockserver.org',
    settings: [{ id: 'mock', path: '/dicomweb', write: false }],
  })
  manager.searchForStudies = searchForStudies
  manager.searchForSeries = searchForSeries
  return { [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: manager }
}

const uids = (studies: Array<{ StudyInstanceUID: string }>): string[] =>
  studies.map((study) => study.StudyInstanceUID)

describe('useStudies', () => {
  it('stops loading without a slide microscopy client', async () => {
    const { result } = renderHook(() => useStudies({ clients: {} }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.studies).toEqual([])
  })

  it('loads the studies of the current server', async () => {
    const clients = createClients(async () => [studyJson('1.1', ['SM'])])
    const { result } = renderHook(() => useStudies({ clients }))

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(uids(result.current.studies)).toEqual(['1.1'])
  })

  it('drops results of a superseded search', async () => {
    const slow = deferred<dwc.api.Study[]>()
    const oldClients = createClients(async () => await slow.promise)
    const newClients = createClients(async () => [studyJson('new', ['SM'])])

    const { result, rerender } = renderHook(
      ({ clients }: { clients: Clients }) => useStudies({ clients }),
      { initialProps: { clients: oldClients } },
    )
    rerender({ clients: newClients })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      slow.resolve([studyJson('old-1', ['SM']), studyJson('old-2', ['SM'])])
      await slow.promise
    })

    expect(uids(result.current.studies)).toEqual(['new'])
  })

  it('backfills missing modalities from the series', async () => {
    const searchForSeries = jest.fn(async () => [
      seriesJson('SR'),
      seriesJson('OT'),
    ])
    const clients = createClients(
      async () => [studyJson('with', ['SM']), studyJson('without')],
      searchForSeries,
    )
    const { result } = renderHook(() => useStudies({ clients }))

    await waitFor(() => {
      const backfilled = result.current.studies.find(
        (study) => study.StudyInstanceUID === 'without',
      )
      expect(backfilled?.ModalitiesInStudy).toEqual(['OT', 'SR'])
    })
    expect(searchForSeries).toHaveBeenCalledTimes(1)
    expect(searchForSeries).toHaveBeenCalledWith({
      studyInstanceUID: 'without',
    })
  })

  it('ignores enrichment that finishes after the hook unmounts', async () => {
    const series = deferred<dwc.api.Series[]>()
    const clients = createClients(
      async () => [studyJson('without')],
      async () => await series.promise,
    )
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { result, unmount } = renderHook(() => useStudies({ clients }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    unmount()
    await act(async () => {
      series.resolve([seriesJson('OT')])
      await series.promise
    })

    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('reports a failed search', async () => {
    const onError = jest
      .spyOn(NotificationMiddleware, 'onError')
      .mockImplementation(() => undefined)
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const clients = createClients(async () => {
      throw new Error('network')
    })
    const { result } = renderHook(() => useStudies({ clients }))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(onError).toHaveBeenCalledTimes(1)
    expect(result.current.studies).toEqual([])

    onError.mockRestore()
    errorSpy.mockRestore()
  })
})
