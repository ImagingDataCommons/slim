import { renderHook } from '@testing-library/react'
import type * as dmv from 'dicom-microscopy-viewer'

import { StorageClasses } from '../../../../data/uids'
import {
  loadDerivedData,
  notifyVisualizationError,
} from '../../services/derivedDataLoaders'
import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestClients, createTestSession } from '../../testing/fixtures'
import {
  type SlidePopulationSources,
  useSlidePopulation,
} from '../useSlidePopulation'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')
vi.mock('../../services/derivedDataLoaders', () => ({
  loadDerivedData: vi.fn(),
  notifyVisualizationError: vi.fn(),
}))

type LoadCallbacks = Parameters<typeof loadDerivedData>[1]

function segmentationDataset(): dmv.metadata.Dataset {
  return {
    SOPClassUID: StorageClasses.SEGMENTATION,
    SeriesInstanceUID: 'seg-series',
  }
}

function createSources(
  derivedDataset: dmv.metadata.Dataset | undefined,
): SlidePopulationSources {
  const resettable = () => ({ reset: vi.fn(), showSeries: vi.fn() })
  return {
    clients: createTestClients(),
    studyInstanceUID: '1',
    derivedDataset,
    refreshSnapshot: vi.fn(),
    viewportLoading: { reset: vi.fn() },
    opticalPaths: { ...resettable(), showDefault: vi.fn() },
    presentationStates: { load: vi.fn() },
    rois: {
      reset: vi.fn(),
      registerRoi: vi.fn(),
      showAll: vi.fn(),
      onVisibilityChanges: vi.fn(),
    },
    annotationGroups: resettable(),
    segmentations: resettable(),
    parametricMaps: resettable(),
    hoveredRoiTooltip: { reset: vi.fn() },
  }
}

function populate(sources: SlidePopulationSources) {
  const test = createTestSession()
  let callbacks: LoadCallbacks | undefined
  let context: Parameters<typeof loadDerivedData>[0] | undefined
  vi.mocked(loadDerivedData).mockImplementation(
    (received, receivedCallbacks) => {
      context = received
      callbacks = receivedCallbacks
    },
  )
  const { result } = renderHook(() => useSlidePopulation(sources))
  result.current(test.session)
  return {
    ...test,
    onLoaded: () => callbacks?.onLoaded(),
    onSettled: (kind: Parameters<NonNullable<LoadCallbacks['onSettled']>>[0]) =>
      callbacks?.onSettled?.(kind),
    registerRoi: (uid: string) =>
      callbacks?.registerRoi({ uid } as unknown as dmv.roi.ROI),
    onChange: () => context?.onChange(),
  }
}

beforeEach(() => {
  resetFakeDmv()
})

describe('useSlidePopulation', () => {
  it('resets the panels, shows the default paths and starts the loads', () => {
    const sources = createSources(undefined)
    const { session } = populate(sources)

    for (const resettable of [
      sources.viewportLoading,
      sources.opticalPaths,
      sources.rois,
      sources.annotationGroups,
      sources.segmentations,
      sources.parametricMaps,
      sources.hoveredRoiTooltip,
    ]) {
      expect(resettable.reset).toHaveBeenCalledTimes(1)
    }
    expect(sources.opticalPaths.showDefault).toHaveBeenCalledWith(session)
    expect(sources.presentationStates.load).toHaveBeenCalledWith(session)
    expect(loadDerivedData).toHaveBeenCalledWith(
      expect.objectContaining({ session, studyInstanceUID: '1' }),
      expect.anything(),
    )
  })

  it('shows the derived dataset opened by URL once everything loaded', () => {
    const sources = createSources(segmentationDataset())
    const { session, onLoaded } = populate(sources)
    expect(sources.segmentations.showSeries).not.toHaveBeenCalled()

    onLoaded()

    expect(sources.segmentations.showSeries).toHaveBeenCalledWith(
      session,
      'seg-series',
    )
  })

  it('shows nothing for released viewers', () => {
    const sources = createSources(segmentationDataset())
    const { session, onLoaded } = populate(sources)

    session.isDestroyed = true
    onLoaded()

    expect(sources.segmentations.showSeries).not.toHaveBeenCalled()
  })

  it('shows ROIs of reports that arrive after an SR link showed all', () => {
    const sources = createSources({
      SOPClassUID: StorageClasses.COMPREHENSIVE_3D_SR,
      SeriesInstanceUID: 'sr-series',
    })
    const { session, onLoaded, registerRoi, onChange } = populate(sources)

    registerRoi('early')
    onChange()
    onLoaded()
    expect(sources.rois.showAll).toHaveBeenCalledWith(session)
    expect(sources.rois.onVisibilityChanges).not.toHaveBeenCalled()

    registerRoi('late-1')
    registerRoi('late-2')
    onChange()

    expect(sources.rois.onVisibilityChanges).toHaveBeenCalledWith([
      { uid: 'late-1', isVisible: true },
      { uid: 'late-2', isVisible: true },
    ])
  })

  it('leaves late ROIs hidden when the link is not an SR', () => {
    const sources = createSources(segmentationDataset())
    const { onLoaded, registerRoi, onChange } = populate(sources)

    onLoaded()
    registerRoi('late')
    onChange()

    expect(sources.rois.onVisibilityChanges).not.toHaveBeenCalled()
  })

  it('shows a derived dataset that arrives after the loads finished', () => {
    const test = createTestSession()
    let callbacks: LoadCallbacks | undefined
    vi.mocked(loadDerivedData).mockImplementation((_, receivedCallbacks) => {
      callbacks = receivedCallbacks
    })
    const initial = createSources(undefined)
    const { result, rerender } = renderHook(
      ({ sources }: { sources: SlidePopulationSources }) =>
        useSlidePopulation(sources),
      { initialProps: { sources: initial } },
    )
    result.current(test.session)
    callbacks?.onLoaded()
    expect(initial.segmentations.showSeries).not.toHaveBeenCalled()

    rerender({ sources: { ...initial, derivedDataset: segmentationDataset() } })
    expect(initial.segmentations.showSeries).toHaveBeenCalledWith(
      test.session,
      'seg-series',
    )

    rerender({ sources: { ...initial, derivedDataset: segmentationDataset() } })
    expect(initial.segmentations.showSeries).toHaveBeenCalledTimes(1)
  })

  it('shows a deep-linked SEG once segmentations loaded, without waiting for the rest', () => {
    const sources = createSources(segmentationDataset())
    const { session, onSettled, onLoaded } = populate(sources)

    onSettled('annotationGroups')
    expect(sources.segmentations.showSeries).not.toHaveBeenCalled()

    onSettled('segments')
    expect(sources.segmentations.showSeries).toHaveBeenCalledWith(
      session,
      'seg-series',
    )

    onLoaded()
    expect(sources.segmentations.showSeries).toHaveBeenCalledTimes(1)
  })

  it('reports a linked dataset that cannot be shown instead of throwing', () => {
    const sources = createSources(segmentationDataset())
    sources.segmentations.showSeries = vi.fn(() => {
      throw new Error('cannot draw')
    })
    const { onSettled } = populate(sources)

    expect(() => onSettled('segments')).not.toThrow()
    expect(sources.segmentations.showSeries).toHaveBeenCalledTimes(1)
    expect(notifyVisualizationError).toHaveBeenCalledWith(
      'The linked dataset could not be displayed.',
    )
  })
})
