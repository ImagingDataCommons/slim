import { act, renderHook, waitFor } from '@testing-library/react'
import type { MockedFunction } from 'vitest'

import type DicomWebManager from '../../DicomWebManager'
import type { Slide } from '../../data/slides'
import { StorageClasses } from '../../data/uids'
import { fetchImageMetadata } from '../../services/fetchImageMetadata'
import { clearSlidesCache, useSlides } from '../useSlides'

vi.mock('../../services/fetchImageMetadata', () => ({
  fetchImageMetadata: vi.fn(),
}))

const mockedFetch = fetchImageMetadata as MockedFunction<
  typeof fetchImageMetadata
>

const clientsFor = (baseURL: string): { [key: string]: DicomWebManager } => ({
  [StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]: {
    baseURL,
  } as unknown as DicomWebManager,
})

const slide = { volumeImages: [{}] } as unknown as Slide

/** Resolve every fetch with the given slides */
const respondWith = (slides: Slide[]): void => {
  mockedFetch.mockImplementation(({ onSuccess }) => {
    onSuccess(slides)
    return Promise.resolve()
  })
}

describe('useSlides', () => {
  beforeEach(() => {
    clearSlidesCache()
  })

  it('refetches a study that had no slides instead of caching the empty result', async () => {
    respondWith([])
    const clients = clientsFor('https://a.test/dicomWeb')

    const first = renderHook(() =>
      useSlides({ clients, studyInstanceUID: '1.2.3' }),
    )
    await waitFor(() => expect(first.result.current.isLoading).toBe(false))
    first.unmount()

    respondWith([slide])
    const second = renderHook(() =>
      useSlides({ clients, studyInstanceUID: '1.2.3' }),
    )
    await waitFor(() => expect(second.result.current.slides).toEqual([slide]))
    expect(mockedFetch).toHaveBeenCalledTimes(2)
  })

  it('does not serve slides cached for the same study on another server', async () => {
    const clientsA = clientsFor('https://a.test/dicomWeb')
    const clientsB = clientsFor('https://b.test/dicomWeb')
    respondWith([slide])
    const first = renderHook(() =>
      useSlides({ clients: clientsA, studyInstanceUID: '1.2.3' }),
    )
    await waitFor(() => expect(first.result.current.slides).toEqual([slide]))
    first.unmount()

    respondWith([])
    const second = renderHook(() =>
      useSlides({ clients: clientsB, studyInstanceUID: '1.2.3' }),
    )
    await waitFor(() => expect(second.result.current.isLoading).toBe(false))
    expect(second.result.current.slides).toEqual([])
    expect(mockedFetch).toHaveBeenCalledTimes(2)
  })

  it('reports a failed fetch and loads the study on retry', async () => {
    mockedFetch.mockImplementation(({ onError }) => {
      onError(new Error('unreachable'))
      return Promise.resolve()
    })
    const clients = clientsFor('https://a.test/dicomWeb')
    const { result } = renderHook(() =>
      useSlides({ clients, studyInstanceUID: '1.2.3' }),
    )
    await waitFor(() => expect(result.current.error).not.toBeNull())

    respondWith([slide])
    act(() => {
      result.current.retry()
    })

    await waitFor(() => expect(result.current.slides).toEqual([slide]))
    expect(result.current.error).toBeNull()
  })
})
