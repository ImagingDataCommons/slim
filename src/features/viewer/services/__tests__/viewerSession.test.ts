import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession } from '../../testing/fixtures'
import { destroyViewerSession } from '../viewerSession'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/logger')

beforeEach(() => {
  resetFakeDmv()
})

describe('createViewerSession', () => {
  it('starts with every optical path inactive and empty caches', () => {
    const { session, viewer } = createTestSession()

    expect(viewer.isOpticalPathActive('1')).toBe(false)
    expect(session).toMatchObject({ generation: 1, isDestroyed: false })
    expect(session.loadingFrames.size).toBe(0)
    expect(session.labelViewer).toBeDefined()
  })
})

describe('destroyViewerSession', () => {
  it('empties the containers and releases the viewers once', () => {
    const { session, viewer } = createTestSession()
    const volume = document.createElement('div')
    volume.innerHTML = '<canvas></canvas>'
    const label = document.createElement('div')
    label.innerHTML = '<canvas></canvas>'

    destroyViewerSession(session, { volume, label })
    destroyViewerSession(session, { volume, label })

    expect(session.isDestroyed).toBe(true)
    expect(volume.innerHTML).toBe('')
    expect(label.innerHTML).toBe('')
    expect(viewer.cleanup).toHaveBeenCalledTimes(1)
  })
})
