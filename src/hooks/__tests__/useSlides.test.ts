import { act, renderHook, waitFor } from '@testing-library/react'
import type { MockedFunction } from 'vitest'

import type DicomWebManager from '../../DicomWebManager'
import type { Slide } from '../../data/slides'
import { StorageClasses } from '../../data/uids'
import { fetchImageMetadata } from '../../services/fetchImageMetadata'
import {
  clearSlidesCache,
  isSlidesCached,
  MAX_CACHED_STUDIES,
  useSlides,
} from '../useSlides'

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

  it('refreshes every consumer of the study when one of them retries', async () => {
    mockedFetch.mockImplementation(({ onError }) => {
      onError(new Error('unreachable'))
      return Promise.resolve()
    })
    const clients = clientsFor('https://a.test/dicomWeb')
    const viewer = renderHook(() =>
      useSlides({ clients, studyInstanceUID: '1.2.4' }),
    )
    const validation = renderHook(() =>
      useSlides({ clients, studyInstanceUID: '1.2.4' }),
    )
    await waitFor(() => expect(validation.result.current.error).not.toBeNull())

    respondWith([slide])
    act(() => {
      viewer.result.current.retry()
    })

    /** Each hook renders in its own root, and the roots commit separately */
    await waitFor(() => {
      expect(validation.result.current.slides).toEqual([slide])
      expect(viewer.result.current.slides).toEqual([slide])
    })
  })

  it('ignores a slower fetch for the previous study', async () => {
    const clients = clientsFor('https://a.test/dicomWeb')
    const slowSlide = { volumeImages: [{}, {}] } as unknown as Slide
    let finishSlowFetch: (() => void) | undefined
    mockedFetch.mockImplementation(({ studyInstanceUID, onSuccess }) => {
      if (studyInstanceUID === 'slow') {
        finishSlowFetch = () => onSuccess([slowSlide])
      } else {
        onSuccess([slide])
      }
      return Promise.resolve()
    })
    const { result, rerender } = renderHook(
      ({ studyInstanceUID }) => useSlides({ clients, studyInstanceUID }),
      { initialProps: { studyInstanceUID: 'slow' } },
    )

    rerender({ studyInstanceUID: 'fast' })
    await waitFor(() => expect(result.current.slides).toEqual([slide]))
    await act(async () => {
      finishSlowFetch?.()
      await Promise.resolve()
    })

    expect(result.current.slides).toEqual([slide])
  })

  it("never returns the previous study's slides for the new one", async () => {
    const clients = clientsFor('https://a.test/dicomWeb')
    const otherSlide = { volumeImages: [{}, {}] } as unknown as Slide
    mockedFetch.mockImplementation(({ studyInstanceUID, onSuccess }) => {
      onSuccess(studyInstanceUID === 'a' ? [slide] : [otherSlide])
      return Promise.resolve()
    })
    const seen: Array<{ study: string; slides: Slide[]; isLoading: boolean }> =
      []
    const { result, rerender } = renderHook(
      ({ studyInstanceUID }) => {
        const value = useSlides({ clients, studyInstanceUID })
        seen.push({
          study: studyInstanceUID,
          slides: value.slides,
          isLoading: value.isLoading,
        })
        return value
      },
      { initialProps: { studyInstanceUID: 'a' } },
    )
    await waitFor(() => expect(result.current.slides).toEqual([slide]))

    rerender({ studyInstanceUID: 'b' })
    await waitFor(() => expect(result.current.slides).toEqual([otherSlide]))

    for (const render of seen.filter((entry) => entry.study === 'b')) {
      expect(render.slides).not.toContain(slide)
      if (render.slides.length === 0) expect(render.isLoading).toBe(true)
    }
  })

  it('keeps only the most recently loaded studies cached', async () => {
    respondWith([slide])
    const clients = clientsFor('https://a.test/dicomWeb')
    for (let index = 0; index <= MAX_CACHED_STUDIES; index++) {
      const studyInstanceUID = `study-${index}`
      const { result, unmount } = renderHook(() =>
        useSlides({ clients, studyInstanceUID }),
      )
      await waitFor(() => expect(result.current.slides).toEqual([slide]))
      unmount()
    }

    expect(isSlidesCached('study-0')).toBe(false)
    expect(isSlidesCached('study-1')).toBe(true)
    expect(isSlidesCached(`study-${MAX_CACHED_STUDIES}`)).toBe(true)
  })
})
