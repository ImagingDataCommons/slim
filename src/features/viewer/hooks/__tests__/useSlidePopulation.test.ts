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

jest.mock(
  'dicom-microscopy-viewer',
  () =>
    jest.requireActual<typeof import('../../testing/fakeDmv')>(
      '../../testing/fakeDmv',
    ).fakeDmvModule,
)
jest.mock('../../../../utils/logger')
jest.mock('../../services/derivedDataLoaders', () => ({
  loadDerivedData: jest.fn(),
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
  const resettable = () => ({ reset: jest.fn(), showSeries: jest.fn() })
  return {
    clients: createTestClients(),
    studyInstanceUID: '1',
    derivedDataset,
    refreshSnapshot: jest.fn(),
    viewportLoading: { reset: jest.fn() },
    opticalPaths: { ...resettable(), showDefault: jest.fn() },
    presentationStates: { load: jest.fn() },
    rois: { reset: jest.fn(), registerRoi: jest.fn(), showAll: jest.fn() },
    annotationGroups: resettable(),
    segmentations: resettable(),
    parametricMaps: resettable(),
    hoveredRoiTooltip: { reset: jest.fn() },
  }
}

function populate(sources: SlidePopulationSources) {
  const test = createTestSession()
  let callbacks: LoadCallbacks | undefined
  jest.mocked(loadDerivedData).mockImplementation((_, received) => {
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
