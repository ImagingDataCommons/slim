import { renderHook } from '@testing-library/react'
import type * as dmv from 'dicom-microscopy-viewer'

import { StorageClasses } from '../../../../data/uids'
import { loadDerivedData } from '../../services/derivedDataLoaders'
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
    rois: { reset: vi.fn(), registerRoi: vi.fn(), showAll: vi.fn() },
    annotationGroups: resettable(),
    segmentations: resettable(),
    parametricMaps: resettable(),
    hoveredRoiTooltip: { reset: vi.fn() },
  }
}

function populate(sources: SlidePopulationSources) {
  const test = createTestSession()
  let callbacks: LoadCallbacks | undefined
  vi.mocked(loadDerivedData).mockImplementation((_, received) => {
    callbacks = received
  })
  const { result } = renderHook(() => useSlidePopulation(sources))
  result.current(test.session)
  return { ...test, onLoaded: () => callbacks?.onLoaded() }
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
})
