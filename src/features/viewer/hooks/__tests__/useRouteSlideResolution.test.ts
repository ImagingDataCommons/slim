import { renderHook, waitFor } from '@testing-library/react'

import { resolveDerivedSeriesSlide } from '../../services/resolveDerivedSeries'
import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestClients, createTestSlide } from '../../testing/fixtures'
import { useRouteSlideResolution } from '../useRouteSlideResolution'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')
vi.mock('../../services/resolveDerivedSeries', () => ({
  resolveDerivedSeriesSlide: vi.fn(),
}))

const IMAGE_SERIES = '2.25.900000000000000000000000000000000000002'
const DERIVED_SERIES = '2.25.900000000000000000000000000000000000099'

beforeEach(() => {
  resetFakeDmv()
})

describe('useRouteSlideResolution', () => {
  it('looks a derived series up once and drops it on the image series', async () => {
    const slide = createTestSlide(IMAGE_SERIES)
    const derivedDataset = {
      SeriesInstanceUID: DERIVED_SERIES,
      SOPInstanceUID: '2.25.7',
    }
    vi.mocked(resolveDerivedSeriesSlide).mockResolvedValue({
      kind: 'referenced',
      slide,
      derivedDataset,
    } as never)
    const clients = createTestClients()
    const navigate = vi.fn()
    const { result, rerender } = renderHook(
      ({ seriesInstanceUID }: { seriesInstanceUID: string }) =>
        useRouteSlideResolution({
          clients,
          slides: [slide],
          studyInstanceUID: '2.25.1',
          seriesInstanceUID,
          location: { pathname: `/series/${seriesInstanceUID}`, search: '' },
          navigate,
        }),
      { initialProps: { seriesInstanceUID: DERIVED_SERIES } },
    )

    await waitFor(() =>
      expect(result.current.derivedDataset).toBe(derivedDataset),
    )
    expect(result.current.selectedSlide).toBe(slide)
    expect(resolveDerivedSeriesSlide).toHaveBeenCalledTimes(1)

    rerender({ seriesInstanceUID: IMAGE_SERIES })

    await waitFor(() => expect(result.current.derivedDataset).toBeNull())
    expect(result.current.selectedSlide).toBe(slide)
  })

  it('keeps a derived-series lookup in flight when only the query changes', async () => {
    const slide = createTestSlide(IMAGE_SERIES)
    const derivedDataset = {
      SeriesInstanceUID: DERIVED_SERIES,
      SOPInstanceUID: '2.25.7',
    }
    vi.mocked(resolveDerivedSeriesSlide).mockClear()
    vi.mocked(resolveDerivedSeriesSlide).mockResolvedValue({
      kind: 'referenced',
      slide,
      derivedDataset,
    } as never)
    const clients = createTestClients()
    const navigate = vi.fn()
    const slides = [slide]
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) =>
        useRouteSlideResolution({
          clients,
          slides,
          studyInstanceUID: '2.25.1',
          seriesInstanceUID: DERIVED_SERIES,
          location: { pathname: `/series/${DERIVED_SERIES}`, search },
          navigate,
        }),
      { initialProps: { search: '' } },
    )
    rerender({ search: '?state=2.25.9' })

    await waitFor(() =>
      expect(result.current.derivedDataset).toBe(derivedDataset),
    )
    expect(resolveDerivedSeriesSlide).toHaveBeenCalledTimes(1)
  })

  it('corrects a mangled series UID in the first URL', async () => {
    const slide = createTestSlide(IMAGE_SERIES)
    const slides = [slide]
    const clients = createTestClients()
    const navigate = vi.fn()
    renderHook(() =>
      useRouteSlideResolution({
        clients,
        slides,
        studyInstanceUID: '2.25.1',
        seriesInstanceUID: `${IMAGE_SERIES}.0`,
        location: { pathname: `/series/${IMAGE_SERIES}.0`, search: '?x=1' },
        navigate,
      }),
    )

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        { pathname: `/series/${IMAGE_SERIES}`, search: '?x=1' },
        { replace: true },
      ),
    )
  })

  it('returns the slide of a new image route in the same render', () => {
    const first = createTestSlide(IMAGE_SERIES)
    const second = createTestSlide(
      '2.25.900000000000000000000000000000000000003',
    )
    const slides = [first, second]
    const clients = createTestClients()
    const navigate = vi.fn()
    const seen: Array<string | undefined> = []
    const { rerender } = renderHook(
      ({ seriesInstanceUID }: { seriesInstanceUID: string }) => {
        const value = useRouteSlideResolution({
          clients,
          slides,
          studyInstanceUID: '2.25.1',
          seriesInstanceUID,
          location: { pathname: `/series/${seriesInstanceUID}`, search: '' },
          navigate,
        })
        seen.push(value.selectedSlide?.seriesInstanceUIDs[0])
        return value
      },
      { initialProps: { seriesInstanceUID: IMAGE_SERIES } },
    )
    seen.length = 0

    rerender({ seriesInstanceUID: second.seriesInstanceUIDs[0] })

    expect(seen).not.toContain(IMAGE_SERIES)
  })
})
