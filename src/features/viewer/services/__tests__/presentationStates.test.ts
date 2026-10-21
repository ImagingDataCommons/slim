import type DicomWebManager from '../../../../DicomWebManager'
import type { Slide } from '../../../../data/slides'
import { StorageClasses } from '../../../../data/uids'
import { notifyVisualizationError } from '../derivedDataLoaders'
import { loadPresentationStates } from '../presentationStates'

vi.mock('dcmjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dcmjs')>()
  return {
    ...actual,
    data: {
      ...actual.data,
      DicomMessage: { readFile: (dict: unknown) => ({ dict }) },
    },
  }
})
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

  it('reports a default that cannot be applied after an earlier retrieve fails', async () => {
    const instance = (uid: string) => ({
      SOPClassUID: StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE,
      SeriesInstanceUID: 'pr-series',
      SOPInstanceUID: uid,
    })
    let failFirst: (() => void) | undefined
    const client = {
      searchForInstances: vi.fn(async () => [
        instance('ps-0'),
        instance('ps-1'),
      ]),
      retrieveInstance: vi.fn(
        ({ sopInstanceUID }: { sopInstanceUID: string }) =>
          sopInstanceUID === 'ps-0'
            ? new Promise((_, reject) => {
                failFirst = () => reject(new Error('retrieve failed'))
              })
            : Promise.resolve({
                SOPInstanceUID: 'ps-1',
                AdvancedBlendingSequence: [{ SeriesInstanceUID: 's1' }],
              }),
      ),
    } as unknown as DicomWebManager
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    loadPresentationStates({
      client,
      studyInstanceUID: '1',
      slide: {
        seriesInstanceUIDs: ['s1'],
        areVolumeImagesMonochrome: true,
      } as unknown as Slide,
      onPresentationState: vi.fn(),
      onDefaultPresentationState: () => {
        throw new Error('bad palette')
      },
    })
    await vi.waitFor(() => expect(failFirst).toBeDefined())
    await new Promise((resolve) => setTimeout(resolve, 0))
    failFirst?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off('unhandledRejection', unhandled)

    expect(notifyVisualizationError).toHaveBeenCalledWith(
      'Presentation State could not be loaded',
    )
    expect(notifyVisualizationError).toHaveBeenCalledWith(
      'Presentation State could not be applied',
    )
    expect(unhandled).not.toHaveBeenCalled()
  })

  it('still chooses a default when reporting a failed retrieve throws', async () => {
    const instance = (uid: string) => ({
      SOPClassUID: StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE,
      SeriesInstanceUID: 'pr-series',
      SOPInstanceUID: uid,
    })
    const client = {
      searchForInstances: vi.fn(async () => [
        instance('ps-0'),
        instance('ps-1'),
      ]),
      retrieveInstance: vi.fn(
        async ({ sopInstanceUID }: { sopInstanceUID: string }) => {
          if (sopInstanceUID === 'ps-0') throw new Error('retrieve failed')
          return {
            SOPInstanceUID: 'ps-1',
            AdvancedBlendingSequence: [{ SeriesInstanceUID: 's1' }],
          }
        },
      ),
    } as unknown as DicomWebManager
    vi.mocked(notifyVisualizationError).mockImplementation(() => {
      throw new Error('subscriber failed')
    })
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onDefault = vi.fn()
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    loadPresentationStates({
      client,
      studyInstanceUID: '1',
      slide: {
        seriesInstanceUIDs: ['s1'],
        areVolumeImagesMonochrome: true,
      } as unknown as Slide,
      onPresentationState: vi.fn(),
      onDefaultPresentationState: onDefault,
    })
    await vi.waitFor(() =>
      expect(onDefault).toHaveBeenCalledWith(
        expect.objectContaining({ SOPInstanceUID: 'ps-1' }),
      ),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off('unhandledRejection', unhandled)
    vi.mocked(notifyVisualizationError).mockReset()
    logError.mockRestore()
    expect(unhandled).not.toHaveBeenCalled()
  })
})
