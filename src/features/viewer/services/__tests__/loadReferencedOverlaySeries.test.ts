import {
  type DerivedDataContext,
  notifyVisualizationError,
} from '../derivedDataContext'
import { loadReferencedOverlaySeries } from '../loadReferencedOverlaySeries'

vi.mock('../../../../utils/logger')

vi.mock('../derivedDataContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../derivedDataContext')>()),
  notifyVisualizationError: vi.fn(),
}))

vi.mock('../../utils/derivedDataset', () => ({
  sharesReferenceFrame: () => true,
}))

let retrieved: unknown[] = []

vi.mock('../loadSeriesMetadata', () => ({
  loadSeriesMetadata: async ({
    onMetadata,
  }: {
    onMetadata: (metadata: unknown[]) => void
  }) => {
    onMetadata(retrieved)
  },
}))

describe('loadReferencedOverlaySeries', () => {
  it('skips a malformed instance and still adds the valid ones', async () => {
    retrieved = [{ bad: true }, { id: 'good' }]
    const addItems = vi.fn()
    const onChange = vi.fn()

    await loadReferencedOverlaySeries({
      session: {
        isDestroyed: false,
        slide: { volumeImages: [{}] },
      } as unknown as DerivedDataContext['session'],
      client: {} as never,
      studyInstanceUID: '2.25.1',
      modality: 'SEG',
      label: 'Segmentation',
      onChange,
      createItem: (metadata) => {
        if ((metadata as { bad?: boolean }).bad) throw new Error('malformed')
        return metadata as never
      },
      addItems,
      applyPalettes: vi.fn(),
      errorMessage: 'Segmentations cannot be displayed',
      errorLogLabel: 'failed to add segments',
    })

    expect(addItems).toHaveBeenCalledWith([{ id: 'good' }])
    expect(notifyVisualizationError).toHaveBeenCalledTimes(1)
    expect(notifyVisualizationError).toHaveBeenCalledWith(
      'Segmentations cannot be displayed',
    )
    expect(onChange).toHaveBeenCalled()
  })
})
