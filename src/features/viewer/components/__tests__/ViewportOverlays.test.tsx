import { render, screen } from '@testing-library/react'

import {
  ViewportOverlays,
  type ViewportOverlaysProps,
} from '../ViewportOverlays'

function renderOverlays(props: Partial<ViewportOverlaysProps> = {}): void {
  render(
    <ViewportOverlays
      getMap={() => undefined}
      slideId="SLIDE-1"
      slideDescription="H&E"
      {...props}
    />,
  )
}

describe('ViewportOverlays', () => {
  it('shows the slide name, zoom controls and scale card by default', () => {
    renderOverlays()
    expect(screen.getByText('SLIDE-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Fit to view' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/x — · y —/)).toBeInTheDocument()
  })

  it('hides the slide name', () => {
    renderOverlays({ showSlideLabel: false })
    expect(screen.queryByText('SLIDE-1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
  })

  it('hides the zoom controls', () => {
    renderOverlays({ showZoomControls: false })
    expect(
      screen.queryByRole('button', { name: 'Zoom in' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Fit to view' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('SLIDE-1')).toBeInTheDocument()
  })

  it('hides the scale and position card', () => {
    renderOverlays({ showViewportInfo: false })
    expect(screen.queryByText(/x — · y —/)).not.toBeInTheDocument()
    expect(screen.getByText('SLIDE-1')).toBeInTheDocument()
  })
})
