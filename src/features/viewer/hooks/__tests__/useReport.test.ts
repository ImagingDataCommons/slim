import { act, renderHook, waitFor } from '@testing-library/react'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import { StorageClasses } from '../../../../data/uids'
import generateReport from '../../../../utils/generateReport'
import { publishToast } from '../../services/toast'
import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestClients, createTestSession } from '../../testing/fixtures'
import { useReport } from '../useReport'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')
vi.mock('../../../../utils/generateReport', () => ({ default: vi.fn() }))
vi.mock('../../../../utils/encodeDicomDataset', () => ({
  encodeDicomDataset: vi.fn(() => new ArrayBuffer(0)),
}))
vi.mock('../../services/toast', () => ({ publishToast: vi.fn() }))

const app = {
  name: 'Slim',
  version: '0.0.0',
  homepage: 'https://github.com/ImagingDataCommons/slim',
  uid: '1.2.3.7',
}
const report = {} as dmv.metadata.Comprehensive3DSR

function setup() {
  const { access } = createTestSession()
  const clients = createTestClients()
  const dispatch = vi.fn()
  const { result } = renderHook(() =>
    useReport({
      sessionRef: access.sessionRef,
      clients,
      app,
      user: undefined,
      visibleRoiUIDs: new Set(),
      dispatch,
    }),
  )
  return {
    result,
    dispatch,
    storeInstances: vi.mocked(
      clients[StorageClasses.COMPREHENSIVE_3D_SR].storeInstances,
    ),
  }
}

beforeEach(() => {
  resetFakeDmv()
})

describe('useReport', () => {
  it('reports a report that cannot be built instead of failing silently', () => {
    vi.mocked(generateReport).mockImplementation(() => {
      throw new Error("Option 'uid' is required for TrackingIdentifier.")
    })
    const { result, dispatch } = setup()

    act(() => result.current.onGenerate())

    expect(result.current.report).toBeUndefined()
    expect(dispatch).not.toHaveBeenCalled()
    expect(publishToast).toHaveBeenCalledWith(
      'Annotations could not be saved.',
      'error',
      undefined,
      expect.anything(),
    )
  })

  it('previews the report, then stores it', async () => {
    vi.mocked(generateReport).mockReturnValue({
      isReportModalVisible: true,
      generatedReport: report,
    })
    const { result, dispatch, storeInstances } = setup()
    storeInstances.mockResolvedValue(undefined)

    act(() => result.current.onGenerate())
    expect(result.current.report).toBe(report)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setReportModalVisible',
      isVisible: true,
    })

    act(() => result.current.onVerify())
    await waitFor(() =>
      expect(publishToast).toHaveBeenCalledWith(
        'Annotations were saved.',
        'success',
      ),
    )
    expect(result.current.report).toBeUndefined()
  })

  it('reports a rejected store', async () => {
    vi.mocked(generateReport).mockReturnValue({
      isReportModalVisible: true,
      generatedReport: report,
    })
    const { result, storeInstances } = setup()
    storeInstances.mockRejectedValue(new Error('Store is not writable.'))

    act(() => result.current.onGenerate())
    act(() => result.current.onVerify())

    await waitFor(() =>
      expect(publishToast).toHaveBeenCalledWith(
        'Annotations could not be saved.',
        'error',
        undefined,
        expect.anything(),
      ),
    )
  })
})
