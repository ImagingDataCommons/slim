import { render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { TooltipProvider } from '../../../../components/ui/tooltip'
import {
  DESKTOP_LAYOUT_MODE,
  type LayoutMode,
  LayoutModeProvider,
} from '../../../../contexts/LayoutModeContext'
import {
  StudySummaryProvider,
  useStudySummary,
} from '../../../../contexts/StudySummaryContext'
import { ThemeProvider } from '../../../../contexts/ThemeContext'
import { Header } from '../Header'

const APP = {
  name: 'Slim',
  version: '0.46.10',
  homepage: 'https://example.com',
  uid: '1.2.3',
}

const COMPACT: LayoutMode = {
  compactChrome: true,
  overlayPanels: true,
  coarsePointer: true,
}

/** No custom logo, without a real request to the test origin */
beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('', { status: 404 }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

function SeedSummary(): null {
  const { setSummary } = useStudySummary()
  useEffect(() => {
    setSummary({
      patientName: 'PBBXKP',
      studyLabel: 'PBBXKP · 30 Apr 2025',
    })
  }, [setSummary])
  return null
}

function renderHeader(mode: LayoutMode, baseURL?: string): void {
  render(
    <MemoryRouter initialEntries={['/studies/2.25.1/series/1.2.3']}>
      <ThemeProvider>
        <TooltipProvider>
          <LayoutModeProvider value={mode}>
            <StudySummaryProvider>
              <SeedSummary />
              <Routes>
                <Route
                  path="/studies/:studyInstanceUID/*"
                  element={
                    <Header
                      app={APP}
                      showWorklistButton
                      showServerSelectionButton
                      onServerSelection={vi.fn()}
                      clients={{ default: { baseURL } as never }}
                    />
                  }
                />
              </Routes>
            </StudySummaryProvider>
          </LayoutModeProvider>
        </TooltipProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('Header server pill', () => {
  const DESKTOP: LayoutMode = {
    compactChrome: false,
    overlayPanels: false,
    coarsePointer: false,
  }

  it('names the server it is connected to', () => {
    renderHeader(DESKTOP, 'https://dicom.example/dicomWeb')
    expect(
      screen.getByRole('button', {
        name: 'Server https://dicom.example/dicomWeb. Change server',
      }),
    ).toBeInTheDocument()
  })

  it('offers to select a server while the default is blank', () => {
    renderHeader(DESKTOP, '')
    expect(
      screen.getByRole('button', {
        name: 'No server selected. Select a server',
      }),
    ).toHaveTextContent('No server selected')
  })
})

describe('Header compact chrome', () => {
  it('keeps the crumb and hides secondary actions behind More', async () => {
    renderHeader(COMPACT)

    await waitFor(() => {
      expect(screen.getByTitle('PBBXKP · 30 Apr 2025')).toBeInTheDocument()
    })
    expect(screen.queryByText('Slim')).not.toBeInTheDocument()
    expect(screen.queryByText('Worklist')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Debug info' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Select server' }),
    ).not.toBeInTheDocument()
  })
})

describe('Header desktop chrome', () => {
  it('keeps the wordmark and dedicated action buttons', () => {
    renderHeader(DESKTOP_LAYOUT_MODE)

    expect(screen.getByText('Slim')).toBeInTheDocument()
    expect(screen.getByText('Worklist')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Debug info' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'More' }),
    ).not.toBeInTheDocument()
  })
})
