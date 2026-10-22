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

  it('returns a cached study in the first render', async () => {
    const clients = clientsFor('https://a.test/dicomWeb')
    respondWith([slide])
    const first = renderHook(() =>
      useSlides({ clients, studyInstanceUID: 'cached' }),
    )
    await waitFor(() => expect(first.result.current.slides).toEqual([slide]))
    first.unmount()

    const firstRenders: Array<{ slides: Slide[]; isLoading: boolean }> = []
    renderHook(() => {
      const value = useSlides({ clients, studyInstanceUID: 'cached' })
      firstRenders.push({ slides: value.slides, isLoading: value.isLoading })
      return value
    })

    expect(firstRenders[0]).toEqual({ slides: [slide], isLoading: false })
  })

  it("never gives a study without clients another study's slides", async () => {
    const clients = clientsFor('https://a.test/dicomWeb')
    respondWith([slide])
    const first = renderHook(() =>
      useSlides({ clients, studyInstanceUID: 'a' }),
    )
    await waitFor(() => expect(first.result.current.slides).toEqual([slide]))

    const { result } = renderHook(() =>
      useSlides({ clients: undefined, studyInstanceUID: 'b' }),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.slides).toEqual([])
  })

  it('returns a cached study as loaded while another fetch runs', async () => {
    const clients = clientsFor('https://a.test/dicomWeb')
    mockedFetch.mockImplementation(({ studyInstanceUID, onSuccess }) => {
      /** The second study never answers */
      if (studyInstanceUID === 'loaded') onSuccess([slide])
      return Promise.resolve()
    })
    const renders: Array<{ study: string; isLoading: boolean }> = []
    const { result, rerender } = renderHook(
      ({ studyInstanceUID }) => {
        const value = useSlides({ clients, studyInstanceUID })
        renders.push({ study: studyInstanceUID, isLoading: value.isLoading })
        return value
      },
      { initialProps: { studyInstanceUID: 'loaded' } },
    )
    await waitFor(() => expect(result.current.slides).toEqual([slide]))
    rerender({ studyInstanceUID: 'pending' })
    await waitFor(() => expect(result.current.isLoading).toBe(true))
    renders.length = 0

    rerender({ studyInstanceUID: 'loaded' })

    /** The first render back is already loaded */
    expect(renders[0]).toEqual({ study: 'loaded', isLoading: false })
  })

  it('does not return expired slides as loaded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const clients = clientsFor('https://a.test/dicomWeb')
      respondWith([slide])
      const first = renderHook(() =>
        useSlides({ clients, studyInstanceUID: 'old' }),
      )
      await waitFor(() => expect(first.result.current.slides).toEqual([slide]))
      first.unmount()
      vi.advanceTimersByTime(31 * 60 * 1000)
      mockedFetch.mockImplementation(() => new Promise(() => undefined))

      const { result } = renderHook(() =>
        useSlides({ clients, studyInstanceUID: 'old' }),
      )

      expect(result.current).toMatchObject({ slides: [], isLoading: true })
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not take a study without clients as loaded once clients arrive', async () => {
    mockedFetch.mockImplementation(() => new Promise(() => undefined))
    type Props = { clients?: { [key: string]: DicomWebManager } }
    const renders: boolean[] = []
    const { result, rerender } = renderHook(
      ({ clients }: Props) => {
        const value = useSlides({ clients, studyInstanceUID: 'later' })
        renders.push(value.isLoading)
        return value
      },
      { initialProps: {} as Props },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    renders.length = 0

    rerender({ clients: clientsFor('') })

    /** The first render with clients has not loaded the study yet */
    expect(renders[0]).toBe(true)
  })

  it('keeps showing its slides when another consumer evicts or refetches them', async () => {
    const clients = clientsFor('https://a.test/dicomWeb')
    respondWith([slide])
    const viewer = renderHook(() =>
      useSlides({ clients, studyInstanceUID: 'shared' }),
    )
    await waitFor(() => expect(viewer.result.current.slides).toEqual([slide]))

    /** Another consumer finds the entry gone and fetches new slide objects */
    clearSlidesCache('shared')
    const refetched = { volumeImages: [{}] } as unknown as Slide
    respondWith([refetched])
    const dialog = renderHook(() =>
      useSlides({ clients, studyInstanceUID: 'shared' }),
    )
    await waitFor(() => expect(dialog.result.current.slides[0]).toBe(refetched))
    viewer.rerender()

    expect(viewer.result.current.isLoading).toBe(false)
    expect(viewer.result.current.slides[0]).toBe(slide)
  })

  it('shows loading, not an old error, when returning to a study', async () => {
    const clients = clientsFor('https://a.test/dicomWeb')
    mockedFetch.mockImplementation(
      ({ studyInstanceUID, onSuccess, onError }) => {
        if (studyInstanceUID === 'failing') onError(new Error('unreachable'))
        else onSuccess([slide])
        return Promise.resolve()
      },
    )
    /** The second study is cached, so visiting it fetches nothing */
    const other = renderHook(() =>
      useSlides({ clients, studyInstanceUID: 'fine' }),
    )
    await waitFor(() => expect(other.result.current.slides).toEqual([slide]))
    other.unmount()
    const renders: Array<{ study: string; hasError: boolean }> = []
    const { result, rerender } = renderHook(
      ({ studyInstanceUID }) => {
        const value = useSlides({ clients, studyInstanceUID })
        renders.push({
          study: studyInstanceUID,
          hasError: value.error !== null,
        })
        return value
      },
      { initialProps: { studyInstanceUID: 'failing' } },
    )
    await waitFor(() => expect(result.current.error).not.toBeNull())
    rerender({ studyInstanceUID: 'fine' })
    await waitFor(() => expect(result.current.slides).toEqual([slide]))
    mockedFetch.mockImplementation(() => new Promise(() => undefined))
    renders.length = 0

    rerender({ studyInstanceUID: 'failing' })

    expect(renders[0]).toEqual({ study: 'failing', hasError: false })
    expect(result.current.isLoading).toBe(true)
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
