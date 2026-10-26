import { logger } from '../../../../utils/logger'
import type { DerivedDataContext } from '../derivedDataContext'
import { loadDerivedData } from '../derivedDataLoaders'

vi.mock('../../../../utils/logger')
vi.mock('../loadMeasurementReports', () => ({
  loadMeasurementReports: vi.fn(async () => undefined),
}))
vi.mock('../loadAnnotationGroups', () => ({
  loadAnnotationGroups: vi.fn(async () => undefined),
}))
vi.mock('../loadSegmentations', () => ({
  loadSegmentations: vi.fn(async () => {
    throw new Error('SEG failed')
  }),
}))
vi.mock('../loadParametricMaps', () => ({
  loadParametricMaps: vi.fn(async () => undefined),
}))

describe('loadDerivedData', () => {
  it('reports each kind as it settles, failed ones too, then everything', async () => {
    const settled: string[] = []
    const onLoaded = vi.fn()
    loadDerivedData({} as DerivedDataContext, {
      registerRoi: vi.fn(),
      onSettled: (kind) => settled.push(kind),
      onLoaded,
    })

    await vi.waitFor(() => expect(onLoaded).toHaveBeenCalled())
    expect(settled.sort()).toEqual(
      ['annotationGroups', 'mappings', 'rois', 'segments'].sort(),
    )
  })

  it('logs a kind callback that throws and still finishes', async () => {
    const onLoaded = vi.fn()
    loadDerivedData({} as DerivedDataContext, {
      registerRoi: vi.fn(),
      onSettled: () => {
        throw new Error('show failed')
      },
      onLoaded,
    })

    await vi.waitFor(() => expect(onLoaded).toHaveBeenCalled())
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to add derived data:',
      expect.any(Error),
    )
  })
})
