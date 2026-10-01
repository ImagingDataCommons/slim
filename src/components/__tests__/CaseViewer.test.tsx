import { fireEvent, render, screen } from '@testing-library/react'
import type * as React from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import CaseViewer from '../CaseViewer'

const mockSlides = [
  {
    seriesInstanceUIDs: ['1.2.3.1'],
    volumeImages: [{ SeriesInstanceUID: '1.2.3.1' }],
  },
  {
    seriesInstanceUIDs: ['1.2.3.2'],
    volumeImages: [{ SeriesInstanceUID: '1.2.3.2' }],
  },
]

jest.mock('../../hooks/useSlides', () => ({
  useSlides: () => ({
    slides: mockSlides,
    isLoading: false,
    error: null,
    retry: () => {},
  }),
}))

jest.mock('../SlideViewer', () => ({
  __esModule: true,
  default: ({ seriesInstanceUID }: { seriesInstanceUID: string }) => (
    <div data-testid="slide-viewer">{seriesInstanceUID}</div>
  ),
}))

jest.mock('../SlideItem', () => ({
  __esModule: true,
  default: ({
    slide,
    isSelected,
    onSelect,
  }: {
    slide: { seriesInstanceUIDs: string[] }
    isSelected: boolean
    onSelect: (selection: { seriesInstanceUID: string }) => void
  }) => (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() =>
        onSelect({ seriesInstanceUID: slide.seriesInstanceUIDs[0] })
      }
    >
      {slide.seriesInstanceUIDs[0]}
    </button>
  ),
}))

jest.mock('../Patient', () => ({ __esModule: true, default: () => null }))
jest.mock('../Study', () => ({ __esModule: true, default: () => null }))
jest.mock('../ClinicalTrial', () => ({ __esModule: true, default: () => null }))

function LocationProbe(): React.ReactElement {
  const location = useLocation()
  return (
    <output data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</output>
  )
}

function renderAt(path: string): void {
  render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route
          path="/studies/:studyInstanceUID/*"
          element={
            <CaseViewer
              clients={{}}
              studyInstanceUID="1.2.3"
              app={{
                name: 'Slim',
                version: '1.0.0',
                homepage: 'https://example.test',
                uid: '1.2',
              }}
              annotations={[]}
              enableAnnotationTools={false}
              enableMemoryMonitoring={false}
              preload={false}
            />
          }
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('CaseViewer', () => {
  it('redirects a study route without a series to the first slide', async () => {
    renderAt('/studies/1.2.3')

    expect(await screen.findByTestId('slide-viewer')).toHaveTextContent(
      '1.2.3.1',
    )
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/studies/1.2.3/series/1.2.3.1',
    )
    expect(screen.getByRole('button', { name: '1.2.3.1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('keeps the query and hash when redirecting to the first slide', async () => {
    renderAt('/studies/1.2.3?gcp=https%3A%2F%2Fstore.example&access_token=t#x')

    expect(await screen.findByTestId('slide-viewer')).toHaveTextContent(
      '1.2.3.1',
    )
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/studies/1.2.3/series/1.2.3.1?gcp=https%3A%2F%2Fstore.example&access_token=t#x',
    )
  })

  it('keeps the series and query of a series route', async () => {
    renderAt('/studies/1.2.3/series/1.2.3.2?state=9')

    expect(await screen.findByTestId('slide-viewer')).toHaveTextContent(
      '1.2.3.2',
    )
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/studies/1.2.3/series/1.2.3.2?state=9',
    )
    expect(screen.getByRole('button', { name: '1.2.3.2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches series when another slide is selected', async () => {
    renderAt('/studies/1.2.3/series/1.2.3.1')

    fireEvent.click(screen.getByRole('button', { name: '1.2.3.2' }))

    expect(await screen.findByTestId('slide-viewer')).toHaveTextContent(
      '1.2.3.2',
    )
    expect(screen.getByRole('button', { name: '1.2.3.2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
