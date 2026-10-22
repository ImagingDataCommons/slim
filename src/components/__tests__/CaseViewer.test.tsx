import { fireEvent, render, screen } from '@testing-library/react'
import type * as React from 'react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'

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

vi.mock('../../hooks/useSlides', () => ({
  useSlides: () => ({
    slides: mockSlides,
    isLoading: false,
    error: null,
    retry: () => {},
  }),
}))

vi.mock('../SlideViewer', () => ({
  __esModule: true,
  default: ({ seriesInstanceUID }: { seriesInstanceUID: string }) => (
    <div data-testid="slide-viewer">{seriesInstanceUID}</div>
  ),
}))

vi.mock('../SlideItem', () => ({
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

vi.mock('../../features/viewer/services/resolveDerivedSeries', () => ({
  /** 9.9 refers to the second slide; any other series to none */
  resolveDerivedSeriesSlide: async ({
    seriesInstanceUID,
  }: {
    seriesInstanceUID: string
  }) =>
    seriesInstanceUID === '9.9'
      ? {
          kind: 'referenced',
          slide: mockSlides[1],
          derivedDataset: {
            SeriesInstanceUID: '9.9',
            SOPInstanceUID: '9.9.1',
          },
        }
      : { kind: 'unresolved' },
}))

vi.mock('../Patient', () => ({ __esModule: true, default: () => null }))
vi.mock('../Study', () => ({ __esModule: true, default: () => null }))
vi.mock('../ClinicalTrial', () => ({ __esModule: true, default: () => null }))

function LocationProbe(): React.ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <button
        type="button"
        onClick={() => navigate('/studies/1.2.3/series/8.8')}
      >
        open missing series
      </button>
      {probe(location)}
    </>
  )
}

function probe(location: {
  pathname: string
  search: string
  hash: string
}): React.ReactElement {
  return (
    <output data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</output>
  )
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
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

  it('highlights the slide a derived series route resolved to', async () => {
    renderAt('/studies/1.2.3/series/9.9')

    expect(await screen.findByTestId('slide-viewer')).toHaveTextContent(
      '1.2.3.2',
    )
    expect(screen.getByRole('button', { name: '1.2.3.2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('highlights no slide for a series that is not found', async () => {
    renderAt('/studies/1.2.3/series/1.2.3.1')
    expect(await screen.findByTestId('slide-viewer')).toHaveTextContent(
      '1.2.3.1',
    )

    fireEvent.click(screen.getByRole('button', { name: 'open missing series' }))

    expect(await screen.findByText('Series not found')).toBeInTheDocument()
    for (const name of ['1.2.3.1', '1.2.3.2']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    }
  })

  it('reports a percent-encoded series that is not found', async () => {
    renderAt('/studies/1.2.3/series/8.8%20')

    expect(await screen.findByText('Series not found')).toBeInTheDocument()
  })
})
