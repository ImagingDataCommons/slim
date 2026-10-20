import { render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'

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

function renderHeader(mode: LayoutMode): void {
  render(
    <MemoryRouter initialEntries={['/studies/2.25.1/series/1.2.3']}>
      <ThemeProvider>
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
                    clients={{ default: {} as never }}
                  />
                }
              />
            </Routes>
          </StudySummaryProvider>
        </LayoutModeProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

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
