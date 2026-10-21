import type DicomWebManager from '../../../../DicomWebManager'
import { notifyVisualizationError } from '../derivedDataContext'
import { loadSeriesMetadata } from '../loadSeriesMetadata'

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
