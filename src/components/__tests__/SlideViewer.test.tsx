import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter } from 'react-router'

import {
  fakeDmvInstances,
  resetFakeDmv,
} from '../../features/viewer/testing/fakeDmv'
import {
  createTestClients as createClients,
  createTestSlide as createSlide,
  TEST_STUDY_UID as STUDY_UID,
} from '../../features/viewer/testing/fixtures'
import type { AnnotationSettings } from '../../types/annotations'
import SlideViewer from '../SlideViewer'

vi.mock('dicom-microscopy-viewer', async () => {
  const actual = await vi.importActual<
    typeof import('../../features/viewer/testing/fakeDmv')
  >('../../features/viewer/testing/fakeDmv')
  return actual.fakeDmvModule
})

vi.mock('../../utils/logger')

const ANNOTATIONS: AnnotationSettings[] = [
  {
    finding: { value: '85756007', schemeDesignator: 'SCT', meaning: 'Tissue' },
  },
]

type ViewerProps = React.ComponentProps<typeof SlideViewer>

function viewerElement(
  overrides: Partial<ViewerProps> = {},
): React.JSX.Element {
  const slide = overrides.slide ?? createSlide('1.2.3.4')
  return (
    <MemoryRouter initialEntries={[`/studies/${STUDY_UID}/series/1.2.3.4`]}>
      <SlideViewer
        slide={slide}
        clients={overrides.clients ?? createClients()}
        studyInstanceUID={STUDY_UID}
        seriesInstanceUID={slide.seriesInstanceUIDs[0]}
        app={{
          name: 'Slim',
          version: '1.0.0',
          homepage: 'https://example.test',
          uid: '1.2',
        }}
        annotations={ANNOTATIONS}
        enableAnnotationTools
        enableMemoryMonitoring={false}
        preload={false}
        {...overrides}
      />
    </MemoryRouter>
  )
}

async function renderViewer(
  overrides: Partial<ViewerProps> = {},
): Promise<ReturnType<typeof render>> {
  const result = render(viewerElement(overrides))
  /** Let the (empty) derived-data searches settle */
  await act(async () => {
    await Promise.resolve()
  })
  return result
}

function dispatchDmvEvent(name: string, payload: unknown): void {
  document.body.dispatchEvent(
    new CustomEvent(name, { detail: { payload }, bubbles: true }),
  )
}

async function addRoiThroughGoTo(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Go to' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('X coordinate (mm)'), {
    target: { value: '10' },
  })
  fireEvent.change(within(dialog).getByLabelText('Y coordinate (mm)'), {
    target: { value: '20' },
  })
  fireEvent.change(within(dialog).getByLabelText('Magnification'), {
    target: { value: '10' },
  })
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Go to position' }),
  )
  await screen.findByText('ROI 1')
}

beforeEach(() => {
  resetFakeDmv()
  /** ROIs placed through "Go to" have no finding, which is logged */
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SlideViewer', () => {
  it('renders the toolbar and the slide panel sections', async () => {
    await renderViewer()

    for (const name of [
      'Draw',
      'Modify',
      'Translate',
      'Remove',
      'Hide',
      'Save',
      'Go to',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    const panel = screen.getByRole('complementary', { name: 'Slide panel' })
    for (const title of [
      'Slide label',
      'Specimens',
      'Equipment',
      'Optical paths',
      'Annotations',
    ]) {
      expect(within(panel).getByText(title)).toBeInTheDocument()
    }
    expect(
      within(panel).getByText('No ROIs yet. Use Draw to annotate the slide.'),
    ).toBeInTheDocument()
  })

  it('creates the volume and label viewers and renders them into the DOM', async () => {
    await renderViewer()

    expect(fakeDmvInstances.volumeViewers).toHaveLength(1)
    expect(fakeDmvInstances.labelViewers).toHaveLength(1)
    const [volumeViewer] = fakeDmvInstances.volumeViewers
    const [labelViewer] = fakeDmvInstances.labelViewers
    expect(volumeViewer.render).toHaveBeenCalledWith({
      container: expect.any(HTMLDivElement),
    })
    expect(labelViewer.render).toHaveBeenCalledWith({
      container: expect.any(HTMLDivElement),
    })
    expect(volumeViewer.isOpticalPathVisible('1')).toBe(true)
  })

  it('cleans up the viewers on unmount', async () => {
    const { unmount } = await renderViewer()
    const [volumeViewer] = fakeDmvInstances.volumeViewers
    const [labelViewer] = fakeDmvInstances.labelViewers

    unmount()

    expect(volumeViewer.cleanup).toHaveBeenCalled()
    expect(labelViewer.cleanup).toHaveBeenCalled()
  })

  it('rebuilds the viewers when another slide is shown', async () => {
    const clients = createClients()
    const { rerender } = await renderViewer({ clients })
    const [firstViewer] = fakeDmvInstances.volumeViewers

    rerender(viewerElement({ clients, slide: createSlide('1.2.3.5') }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(firstViewer.cleanup).toHaveBeenCalled()
    expect(fakeDmvInstances.volumeViewers).toHaveLength(2)
    expect(fakeDmvInstances.volumeViewers[1].render).toHaveBeenCalled()
  })

  it('navigates and marks the position chosen in the Go to dialog', async () => {
    await renderViewer()
    const [volumeViewer] = fakeDmvInstances.volumeViewers

    fireEvent.click(screen.getByRole('button', { name: 'Go to' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('X coordinate (mm)'), {
      target: { value: '10' },
    })
    fireEvent.change(within(dialog).getByLabelText('Y coordinate (mm)'), {
      target: { value: '20' },
    })
    fireEvent.change(within(dialog).getByLabelText('Magnification'), {
      target: { value: '10' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Go to position' }),
    )

    expect(volumeViewer.navigate).toHaveBeenCalledWith({
      position: [10, 20],
      level: expect.any(Number),
    })
    expect(volumeViewer.rois).toHaveLength(1)
    expect(await screen.findByText('ROI 1')).toBeInTheDocument()
    expect(
      screen.queryByText('No ROIs yet. Use Draw to annotate the slide.'),
    ).not.toBeInTheDocument()
  })

  it('selects an ROI when DMV reports a selection', async () => {
    await renderViewer()
    await addRoiThroughGoTo()
    const [volumeViewer] = fakeDmvInstances.volumeViewers
    const [roi] = volumeViewer.rois

    act(() => {
      dispatchDmvEvent('dicommicroscopyviewer_roi_selected', roi)
    })

    expect(screen.getByText('ROI 1').closest('button')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('removes visible ROIs after confirmation', async () => {
    await renderViewer()
    await addRoiThroughGoTo()
    const [volumeViewer] = fakeDmvInstances.volumeViewers

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Remove all visible annotations?'),
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(volumeViewer.rois).toHaveLength(0)
    expect(
      await screen.findByText('No ROIs yet. Use Draw to annotate the slide.'),
    ).toBeInTheDocument()
  })

  it('cancels the active tool on Escape', async () => {
    await renderViewer()
    const [volumeViewer] = fakeDmvInstances.volumeViewers
    const translate = screen.getByRole('button', { name: 'Translate' })
    fireEvent.click(translate)
    expect(translate).toHaveAttribute('aria-pressed', 'true')

    fireEvent.keyUp(document.body, { key: 'Escape', code: 'Escape' })

    expect(volumeViewer.deactivateTranslateInteraction).toHaveBeenCalled()
    expect(translate).toHaveAttribute('aria-pressed', 'false')
  })

  it('hides the slide panel from the toolbar toggle', async () => {
    await renderViewer()
    const panel = screen.getByRole('complementary', { name: 'Slide panel' })

    fireEvent.click(screen.getByRole('button', { name: 'Toggle slide panel' }))

    expect(panel).toHaveClass('hidden')
  })

  it('toggles the modify tool from the toolbar', async () => {
    await renderViewer()
    const [volumeViewer] = fakeDmvInstances.volumeViewers
    const modify = screen.getByRole('button', { name: 'Modify' })

    fireEvent.click(modify)
    expect(volumeViewer.activateModifyInteraction).toHaveBeenCalled()
    expect(modify).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(modify)
    expect(volumeViewer.deactivateModifyInteraction).toHaveBeenCalled()
    expect(modify).toHaveAttribute('aria-pressed', 'false')
  })
})
