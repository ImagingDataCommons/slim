import { fireEvent, render, screen } from '@testing-library/react'

import { ThemeProvider } from '../../../../contexts/ThemeContext'
import {
  loadPreferences,
  PREFERENCES_STORAGE_KEY,
} from '../../utils/preferences'
import type { RuntimeInfo } from '../../utils/runtimeInfo'
import { PreferencesDialog, type PreferencesTab } from '../PreferencesDialog'

const APP = {
  name: 'slim',
  version: '1.2.3',
  homepage: 'https://github.com/ImagingDataCommons/slim',
}

const RUNTIME: RuntimeInfo = {
  config: { mode: 'dark', servers: [{ id: 'local', url: '/dicomweb' }] },
  configName: 'test',
  slimCommit: 'abcdef1234567',
  dmvVersion: '0.48.0',
  browserLabel: 'Test browser',
  userAgent: 'test-agent',
}

function renderDialog(
  initialTab: PreferencesTab = 'general',
  onOpenChange: (open: boolean) => void = jest.fn(),
): void {
  render(
    <ThemeProvider>
      <PreferencesDialog
        open
        onOpenChange={onOpenChange}
        app={APP}
        initialTab={initialTab}
        runtimeInfo={RUNTIME}
      />
    </ThemeProvider>,
  )
}

describe('PreferencesDialog', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('exposes the sections as tabs with one selected panel', () => {
    renderDialog('annotations')
    const tab = screen.getByRole('tab', { name: 'Annotations' })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(tab).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute(
      'tabindex',
      '-1',
    )
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      tab.id,
    )
  })

  it('moves between tabs with the arrow keys', () => {
    renderDialog('general')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'General' }), {
      key: 'ArrowUp',
    })
    const about = screen.getByRole('tab', { name: 'About Slim' })
    expect(about).toHaveAttribute('aria-selected', 'true')
    expect(about).toHaveFocus()
    expect(screen.getByText('Version and build information')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Save preferences' }),
    ).not.toBeInTheDocument()
  })

  it('saves edited preferences and closes', () => {
    const onOpenChange = jest.fn()
    renderDialog('general', onOpenChange)
    fireEvent.click(screen.getByRole('switch', { name: 'Compact rows' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))
    expect(loadPreferences().compactRows).toBe(true)
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).not.toBeNull()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('lists every keyboard shortcut', () => {
    renderDialog('keys')
    expect(screen.getByText('Draw ROI')).toBeInTheDocument()
    expect(screen.getByText('Go to position')).toBeInTheDocument()
  })

  it('shows the injected configuration', () => {
    renderDialog('config')
    expect(screen.getByText('public/config/test.js')).toBeInTheDocument()
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search configuration' }),
      { target: { value: 'dicomweb' } },
    )
    expect(screen.getByText(/1 match/)).toBeInTheDocument()
  })
})
