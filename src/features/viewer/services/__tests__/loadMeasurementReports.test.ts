/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import { StorageClasses } from '../../../../data/uids'
import type { DerivedDataContext } from '../derivedDataContext'
import { loadMeasurementReports } from '../loadMeasurementReports'

vi.mock('dicom-microscopy-viewer', () => ({
  metadata: {
    formatMetadata: (raw: unknown) => ({ dataset: raw }),
  },
}))

vi.mock('../../../../utils/logger')

const STUDY_UID = '2.25.1'

function srInstance(
  sopClassUid: string,
  sopInstanceUid: string,
): Record<string, string> {
  return {
    SOPClassUID: sopClassUid,
    SeriesInstanceUID: '1.2.3',
    SOPInstanceUID: sopInstanceUid,
  }
}

function setup(searchResult: unknown[] | Error): {
  context: DerivedDataContext
  retrieveInstance: ReturnType<typeof vi.fn>
  registerRoi: (roi: dmv.roi.ROI) => void
  onChange: ReturnType<typeof vi.fn>
} {
  const retrieveInstance = vi.fn()
  const searchForInstances = vi.fn()
  if (searchResult instanceof Error) {
    searchForInstances.mockRejectedValue(searchResult)
  } else {
    searchForInstances.mockResolvedValue(searchResult)
  }
  const client = { searchForInstances, retrieveInstance }
  const onChange = vi.fn()
  const context = {
    session: {
      isDestroyed: false,
      slide: { volumeImages: [{ FrameOfReferenceUID: 'for-1' }] },
      volumeViewer: { getAllROIs: () => [], addROI: vi.fn() },
    },
    clients: { [StorageClasses.COMPREHENSIVE_3D_SR]: client },
    studyInstanceUID: STUDY_UID,
    onChange,
  } as unknown as DerivedDataContext
  const registerRoi = (_roi: dmv.roi.ROI): void => undefined
  return { context, retrieveInstance, registerRoi, onChange }
}

describe('loadMeasurementReports', () => {
  it('settles when the study has no SR instances', async () => {
    const { context, registerRoi, retrieveInstance } = setup([])
    await expect(
      loadMeasurementReports(context, registerRoi),
    ).resolves.toBeUndefined()
    expect(retrieveInstance).not.toHaveBeenCalled()
  })

  it('settles when every SR is the wrong SOP class', async () => {
    const { context, registerRoi, retrieveInstance } = setup([
      srInstance(StorageClasses.COMPREHENSIVE_SR, 'sr-1'),
    ])
    await expect(
      loadMeasurementReports(context, registerRoi),
    ).resolves.toBeUndefined()
    expect(retrieveInstance).not.toHaveBeenCalled()
  })

  it('settles after retrieve failures instead of hanging', async () => {
    const { context, retrieveInstance, registerRoi, onChange } = setup([
      srInstance(StorageClasses.COMPREHENSIVE_3D_SR, 'a'),
      srInstance(StorageClasses.COMPREHENSIVE_3D_SR, 'b'),
    ])
    retrieveInstance.mockRejectedValue(new Error('404'))

    await expect(
      loadMeasurementReports(context, registerRoi),
    ).resolves.toBeUndefined()
    expect(retrieveInstance).toHaveBeenCalledTimes(2)
    expect(onChange).not.toHaveBeenCalled()
  })
})
