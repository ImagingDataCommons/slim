import { renderHook, waitFor } from '@testing-library/react'
import type { metadata } from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import DicomWebManager from '../../../../DicomWebManager'
import { useModalityBackfill } from '../useModalityBackfill'

function study(uid: string, modalities?: string[]): metadata.Study {
  return {
    StudyInstanceUID: uid,
    ModalitiesInStudy: modalities,
  } as unknown as metadata.Study
}

function seriesOf(...modalities: string[]): dwc.api.Series[] {
  return modalities.map((modality) => ({
    '00080060': { vr: 'CS', Value: [modality] },
  })) as dwc.api.Series[]
}

function createClient(
  searchForSeries: DicomWebManager['searchForSeries'],
): DicomWebManager {
  const manager = new DicomWebManager({
    baseUri: 'http://mockserver.org',
    settings: [{ id: 'mock', path: '/dicomweb', write: false }],
  })
  manager.searchForSeries = searchForSeries
  return manager
}

describe('useModalityBackfill', () => {
  it('queries only the studies without modalities', async () => {
    const searchForSeries = vi.fn(async () => seriesOf('SM', 'ANN', 'SM'))
    const client = createClient(searchForSeries)
    const studies = [study('with', ['SM']), study('without')]
    const { result } = renderHook(() => useModalityBackfill(client, studies))

    await waitFor(() =>
      expect(result.current.get('without')).toEqual(['ANN', 'SM']),
    )
    expect(searchForSeries).toHaveBeenCalledTimes(1)
    expect(searchForSeries).toHaveBeenCalledWith({
      studyInstanceUID: 'without',
    })
  })

  it('does not ask again for a study it already looked up', async () => {
    const searchForSeries = vi.fn(async () => seriesOf('SM'))
    const client = createClient(searchForSeries)
    const first = [study('a')]
    const second = [study('b')]
    const { result, rerender } = renderHook(
      ({ studies }: { studies: metadata.Study[] }) =>
        useModalityBackfill(client, studies),
      { initialProps: { studies: first } },
    )
    await waitFor(() => expect(result.current.has('a')).toBe(true))

    rerender({ studies: second })
    await waitFor(() => expect(result.current.has('b')).toBe(true))
    rerender({ studies: first })

    expect(result.current.get('a')).toEqual(['SM'])
    expect(searchForSeries).toHaveBeenCalledTimes(2)
  })

  it('keeps no answers across servers', async () => {
    const first = createClient(vi.fn(async () => seriesOf('SM')))
    const second = createClient(vi.fn(async () => seriesOf('SR')))
    const studies = [study('a')]
    const { result, rerender } = renderHook(
      ({ client }: { client: DicomWebManager }) =>
        useModalityBackfill(client, studies),
      { initialProps: { client: first } },
    )
    await waitFor(() => expect(result.current.get('a')).toEqual(['SM']))

    rerender({ client: second })
    await waitFor(() => expect(result.current.get('a')).toEqual(['SR']))
  })

  it('treats a failed series query as no modalities', async () => {
    const client = createClient(
      vi.fn(async () => {
        throw new Error('network')
      }),
    )
    const { result } = renderHook(() =>
      useModalityBackfill(client, [study('a')]),
    )
    await waitFor(() => expect(result.current.get('a')).toEqual([]))
  })
})
