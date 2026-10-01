import { resetFakeDmv } from '../../testing/fakeDmv'
import { createTestSession } from '../../testing/fixtures'
import { EMPTY_VIEWER_SNAPSHOT, readViewerSnapshot } from '../viewerSnapshot'

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

describe('readViewerSnapshot', () => {
  it('reads the viewer of the session', () => {
    const { session } = createTestSession()

    const snapshot = readViewerSnapshot(session, EMPTY_VIEWER_SNAPSHOT)

    expect(snapshot.generation).toBe(1)
    expect(snapshot.labelViewer).toBe(session.labelViewer)
    expect(snapshot.goToRanges).toEqual({ x: [0, 25], y: [0, 50] })
    expect(snapshot.opticalPaths.map((path) => path.identifier)).toEqual(['1'])
    expect(snapshot.isPaletteDisplayGammaCorrectionEnabled).toBe(true)
  })

  it('stops handing out the map once the session is destroyed', () => {
    const { session, viewer } = createTestSession()
    const snapshot = readViewerSnapshot(session, EMPTY_VIEWER_SNAPSHOT)
    expect(snapshot.getMap()).toBe(viewer.map)

    session.isDestroyed = true

    expect(snapshot.getMap()).toBeUndefined()
  })

  it('keeps the identity of unchanged parts', () => {
    const { session, viewer } = createTestSession()
    viewer.segments.add(
      { uid: 'seg', seriesInstanceUID: 'seg-series', number: 1 },
      [{ SeriesInstanceUID: 'seg-series' }],
    )
    const first = readViewerSnapshot(session, EMPTY_VIEWER_SNAPSHOT)

    const second = readViewerSnapshot(session, first)

    expect(second).not.toBe(first)
    expect(second.goToRanges).toBe(first.goToRanges)
    expect(second.segments).toBe(first.segments)
    expect(second.segmentMetadata).toBe(first.segmentMetadata)
    expect(second.segmentStyles).toBe(first.segmentStyles)
    expect(second.opticalPaths).toBe(first.opticalPaths)
    expect(second.opticalPathMetadata).toBe(first.opticalPathMetadata)
  })

  it('takes new values for changed parts', () => {
    const { session, viewer } = createTestSession()
    const first = readViewerSnapshot(session, EMPTY_VIEWER_SNAPSHOT)
    viewer.segments.add({ uid: 'seg', seriesInstanceUID: 's', number: 1 })
    viewer.setOpticalPathStyle('1', { opacity: 0.5 })

    const second = readViewerSnapshot(session, first)

    expect(second.segments).not.toBe(first.segments)
    expect(second.opticalPathStyles['1'].opacity).toBe(0.5)
  })

  it('lists only annotation groups of the slide series', () => {
    const { session, viewer } = createTestSession()
    const [slideSeries] = session.slide.seriesInstanceUIDs
    viewer.annotationGroups.add({
      uid: 'mine',
      seriesInstanceUID: 'ann',
      referencedSeriesInstanceUID: slideSeries,
    })
    viewer.annotationGroups.add({
      uid: 'other',
      seriesInstanceUID: 'ann',
      referencedSeriesInstanceUID: 'another-slide',
    })

    const snapshot = readViewerSnapshot(session, EMPTY_VIEWER_SNAPSHOT)

    expect(snapshot.annotationGroups.map((group) => group.uid)).toEqual([
      'mine',
    ])
  })
})
