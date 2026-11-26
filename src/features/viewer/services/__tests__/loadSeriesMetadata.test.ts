import type DicomWebManager from '../../../../DicomWebManager'
import { notifyVisualizationError } from '../derivedDataContext'
import { compareSeries, loadSeriesMetadata } from '../loadSeriesMetadata'

vi.mock('dicom-microscopy-viewer', () => ({
  metadata: { formatMetadata: (raw: unknown) => ({ dataset: raw }) },
}))
vi.mock('../../../../utils/logger')
vi.mock('../derivedDataContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../derivedDataContext')>()),
  notifyVisualizationError: vi.fn(),
}))

function failingClient(): DicomWebManager {
  return {
    searchForSeries: vi.fn(async () => {
      throw new Error('search failed')
    }),
  } as unknown as DicomWebManager
}

describe('loadSeriesMetadata', () => {
  beforeEach(() => {
    vi.mocked(notifyVisualizationError).mockClear()
  })

  it('reports a failed search', async () => {
    await expect(
      loadSeriesMetadata({
        client: failingClient(),
        studyInstanceUID: '1',
        modality: 'SEG',
        label: 'Segmentation',
        onMetadata: vi.fn(),
      }),
    ).rejects.toThrow('search failed')
    expect(notifyVisualizationError).toHaveBeenCalledWith(
      'Search for Segmentation instances failed.',
    )
  })

  it('passes series on in series order, whatever order they arrive in', async () => {
    const series = [
      { SeriesInstanceUID: '1.3', SeriesNumber: 3 },
      { SeriesInstanceUID: '1.1', SeriesNumber: 1 },
      { SeriesInstanceUID: '1.2', SeriesNumber: 2 },
    ]
    /** Retrievals finish in reverse series order: 3, then 2, then 1 */
    const finish = new Map<string, () => void>()
    const client = {
      searchForSeries: vi.fn(async () => series),
      retrieveSeriesMetadata: vi.fn(
        async ({ seriesInstanceUID }: { seriesInstanceUID: string }) => {
          await new Promise<void>((resolve) => {
            finish.set(seriesInstanceUID, resolve)
          })
          return [{ uid: seriesInstanceUID }]
        },
      ),
    } as unknown as DicomWebManager
    const received: string[] = []
    const loading = loadSeriesMetadata({
      client,
      studyInstanceUID: '1',
      modality: 'SEG',
      label: 'Segmentation',
      onMetadata: (metadata) => {
        received.push((metadata[0] as unknown as { uid: string }).uid)
      },
    })
    await vi.waitFor(() => expect(finish.size).toBe(3))
    finish.get('1.3')?.()
    finish.get('1.2')?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    /** Held back until the first series is in */
    expect(received).toEqual([])
    finish.get('1.1')?.()
    await loading
    expect(received).toEqual(['1.1', '1.2', '1.3'])
  })

  it('does not hold back the series after a failed one', async () => {
    const client = {
      searchForSeries: vi.fn(async () => [
        { SeriesInstanceUID: '1.1', SeriesNumber: 1 },
        { SeriesInstanceUID: '1.2', SeriesNumber: 2 },
      ]),
      retrieveSeriesMetadata: vi.fn(
        async ({ seriesInstanceUID }: { seriesInstanceUID: string }) => {
          if (seriesInstanceUID === '1.1') throw new Error('not found')
          return [{ uid: seriesInstanceUID }]
        },
      ),
    } as unknown as DicomWebManager
    const onMetadata = vi.fn()
    await loadSeriesMetadata({
      client,
      studyInstanceUID: '1',
      modality: 'SEG',
      label: 'Segmentation',
      onMetadata,
    })
    expect(onMetadata).toHaveBeenCalledTimes(1)
    expect(onMetadata).toHaveBeenCalledWith([{ uid: '1.2' }])
    expect(notifyVisualizationError).toHaveBeenCalledWith(
      'Retrieval of metadata of Segmentation instances failed.',
    )
  })

  it('does not show the error of a viewer that is gone', async () => {
    await expect(
      loadSeriesMetadata({
        client: failingClient(),
        studyInstanceUID: '1',
        modality: 'SEG',
        label: 'Segmentation',
        onMetadata: vi.fn(),
        isCurrent: () => false,
      }),
    ).rejects.toThrow('search failed')
    expect(notifyVisualizationError).not.toHaveBeenCalled()
  })
})

describe('compareSeries', () => {
  it('orders by Series Number, unnumbered series last, then by UID', () => {
    const series = [
      { SeriesInstanceUID: '1.9' },
      { SeriesInstanceUID: '1.5', SeriesNumber: 10 },
      { SeriesInstanceUID: '1.4', SeriesNumber: 2 },
      { SeriesInstanceUID: '1.2' },
      { SeriesInstanceUID: '1.3', SeriesNumber: 2 },
    ]
    expect(
      [...series]
        .sort(
          compareSeries as (
            a: (typeof series)[0],
            b: (typeof series)[0],
          ) => number,
        )
        .map((s) => s.SeriesInstanceUID),
    ).toEqual(['1.3', '1.4', '1.5', '1.2', '1.9'])
  })
})
