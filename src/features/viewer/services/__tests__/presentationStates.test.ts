import type DicomWebManager from '../../../../DicomWebManager'
import type { Slide } from '../../../../data/slides'
import { notifyVisualizationError } from '../derivedDataLoaders'
import { loadPresentationStates } from '../presentationStates'

vi.mock('dicom-microscopy-viewer', () => ({
  metadata: { formatMetadata: (raw: unknown) => ({ dataset: raw }) },
}))
vi.mock('../../../../utils/logger')
vi.mock('../derivedDataLoaders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../derivedDataLoaders')>()),
  notifyVisualizationError: vi.fn(),
}))

function load(isCurrent?: () => boolean): Promise<void> {
  const client = {
    searchForInstances: vi.fn(async () => {
      throw new Error('search failed')
    }),
  } as unknown as DicomWebManager
  loadPresentationStates({
    client,
    studyInstanceUID: '1',
    slide: { seriesInstanceUIDs: ['s1'] } as unknown as Slide,
    onPresentationState: vi.fn(),
    isCurrent,
  })
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('loadPresentationStates', () => {
  beforeEach(() => {
    vi.mocked(notifyVisualizationError).mockClear()
  })

  it('reports a failed search', async () => {
    await load()
    expect(notifyVisualizationError).toHaveBeenCalledWith(
      'Presentation State could not be loaded',
    )
  })

  it('does not show the error of a viewer that is gone', async () => {
    await load(() => false)
    expect(notifyVisualizationError).not.toHaveBeenCalled()
  })
})
