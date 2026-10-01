import { act, fireEvent, render, screen } from '@testing-library/react'
import type { JSX } from 'react'

import { observeOverviewMapClamp } from '../../../../utils/clampOverviewMapInViewport'
import { fakeDmvInstances, resetFakeDmv } from '../../testing/fakeDmv'
import {
  createTestClients,
  createTestSlide,
  TEST_ROI_STYLE,
} from '../../testing/fixtures'
import { buildAnnotationConfig } from '../../utils/annotationConfig'
import {
  useViewerSession,
  useViewerSnapshot,
  type ViewerSessionApi,
  type ViewerSessionOptions,
} from '../useViewerSession'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<typeof import('../../testing/fakeDmv')>(
    '../../testing/fakeDmv',
  )
  return actual.fakeDmvModule
})
vi.mock('../../../../utils/clampOverviewMapInViewport', () => ({
  clampOverviewMapInViewport: vi.fn(),
  observeOverviewMapClamp: vi.fn(() => vi.fn()),
}))
vi.mock('../../../../utils/logger')

let api: ViewerSessionApi | undefined

function Harness({ options }: { options: ViewerSessionOptions }): JSX.Element {
  const store = useViewerSnapshot()
  const sessionApi = useViewerSession(store, options)
  api = sessionApi
  return (
    <>
      <output aria-label="generation">{store.snapshot.generation}</output>
      <div data-testid="volume" ref={sessionApi.volumeViewportRef} />
      <div data-testid="label" ref={sessionApi.labelViewportRef} />
    </>
  )
}

const slide = createTestSlide()
const clients = createTestClients()

function options(
  overrides: Partial<ViewerSessionOptions> = {},
): ViewerSessionOptions {
  return {
    slide,
    clients,
    routeKey: 'route',
    preload: false,
    annotationConfig: buildAnnotationConfig([]),
    defaultRoiStyle: TEST_ROI_STYLE,
    clustering: { isEnabled: true, thresholdInput: '' },
    gammaCorrection: undefined,
    onSessionCreated: vi.fn(),
    ...overrides,
  }
}

function generation(): string | null {
  return screen.getByLabelText('generation').textContent
}

beforeEach(() => {
  resetFakeDmv()
  api = undefined
})

describe('useViewerSession', () => {
  it('creates and renders the viewers, then reports the new session', () => {
    const onSessionCreated = vi.fn()
    render(<Harness options={options({ onSessionCreated })} />)

    const [volumeViewer] = fakeDmvInstances.volumeViewers
    const [labelViewer] = fakeDmvInstances.labelViewers
    expect(volumeViewer.render).toHaveBeenCalledWith({
      container: screen.getByTestId('volume'),
    })
    expect(labelViewer.render).toHaveBeenCalledWith({
      container: screen.getByTestId('label'),
    })
    expect(observeOverviewMapClamp).toHaveBeenCalled()
    expect(generation()).toBe('1')
    expect(onSessionCreated).toHaveBeenCalledTimes(1)
    expect(onSessionCreated.mock.calls[0][0]).toMatchObject({
      generation: 1,
      slide,
      isDestroyed: false,
    })
  })

  it('carries the chosen gamma correction over to new viewers', () => {
    render(<Harness options={options({ gammaCorrection: false })} />)

    const [volumeViewer] = fakeDmvInstances.volumeViewers
    expect(volumeViewer.getPaletteDisplayGammaCorrectionEnabled()).toBe(false)
  })

  it('keeps the viewers when only creation settings change', () => {
    const { rerender } = render(<Harness options={options()} />)

    rerender(
      <Harness
        options={options({
          preload: true,
          gammaCorrection: true,
          clustering: { isEnabled: false, thresholdInput: '1' },
          onSessionCreated: vi.fn(),
        })}
      />,
    )

    expect(fakeDmvInstances.volumeViewers).toHaveLength(1)
    expect(fakeDmvInstances.volumeViewers[0].cleanup).not.toHaveBeenCalled()
  })

  it.each([
    ['slide', { slide: createTestSlide('1.2.3.5') }],
    ['route', { routeKey: 'other-route' }],
    ['clients', { clients: createTestClients() }],
  ])('rebuilds the viewers for a new %s', (_, change) => {
    const onSessionCreated = vi.fn()
    const { rerender } = render(
      <Harness options={options({ onSessionCreated })} />,
    )
    const [first] = fakeDmvInstances.volumeViewers

    rerender(<Harness options={options({ onSessionCreated, ...change })} />)

    expect(first.cleanup).toHaveBeenCalledTimes(1)
    expect(fakeDmvInstances.volumeViewers).toHaveLength(2)
    expect(generation()).toBe('2')
    expect(onSessionCreated).toHaveBeenCalledTimes(2)
    expect(onSessionCreated.mock.calls[0][0].isDestroyed).toBe(true)
  })

  it('releases the viewers on unmount', () => {
    const { unmount } = render(<Harness options={options()} />)
    const [volumeViewer] = fakeDmvInstances.volumeViewers
    const [labelViewer] = fakeDmvInstances.labelViewers

    unmount()

    expect(volumeViewer.cleanup).toHaveBeenCalledTimes(1)
    expect(labelViewer.cleanup).toHaveBeenCalledTimes(1)
  })

  it('releases the viewers once when the page unloads', () => {
    const { unmount } = render(<Harness options={options()} />)
    const [volumeViewer] = fakeDmvInstances.volumeViewers

    fireEvent(window, new Event('beforeunload'))
    unmount()

    expect(volumeViewer.cleanup).toHaveBeenCalledTimes(1)
  })

  it('resizes the viewers with the viewport', () => {
    render(<Harness options={options()} />)
    const [volumeViewer] = fakeDmvInstances.volumeViewers
    const [labelViewer] = fakeDmvInstances.labelViewers

    act(() => {
      api?.onViewportResize()
    })

    expect(volumeViewer.resize).toHaveBeenCalled()
    expect(labelViewer.resize).toHaveBeenCalled()
  })
})
