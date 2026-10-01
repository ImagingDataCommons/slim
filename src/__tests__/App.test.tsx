import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import App from '../App'
import type AppConfig from '../AppConfig'

jest.mock('../features/header', () => ({
  Header: ({
    showWorklistButton,
    showServerSelectionButton,
  }: {
    showWorklistButton: boolean
    showServerSelectionButton: boolean
  }) => (
    <header
      data-testid="header"
      data-worklist-button={String(showWorklistButton)}
      data-server-selection={String(showServerSelectionButton)}
    />
  ),
}))

jest.mock('../features/worklist', () => ({
  Worklist: () => <div>Worklist</div>,
}))

jest.mock('../contexts/ValidationContext', () => ({
  ValidationProvider: ({ children }: { children: ReactNode }) => children,
}))

jest.mock('../components/CaseViewer', () => ({
  __esModule: true,
  default: ({ studyInstanceUID }: { studyInstanceUID: string }) => (
    <div>Case {studyInstanceUID}</div>
  ),
}))

const createConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  servers: [
    { id: 'primary', url: 'https://dicom.example.com/dicomWeb', write: false },
  ],
  path: '/',
  annotations: [],
  ...overrides,
})

const renderAt = (path: string, config: AppConfig = createConfig()): void => {
  window.history.replaceState({}, '', path)
  render(<App config={config} name="slim" version="1.0.0" homepage="/" />)
}

describe('App', () => {
  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(jest.fn())
    /** react-router v7 future-flag notices */
    jest.spyOn(console, 'warn').mockImplementation(jest.fn())
  })

  afterEach(() => {
    jest.restoreAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it('shows the worklist once signed in', async () => {
    renderAt('/', createConfig({ enableServerSelection: true }))

    expect(await screen.findByText('Worklist')).toBeInTheDocument()
    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-server-selection',
      'true',
    )
  })

  it('explains a disabled worklist', async () => {
    renderAt('/', createConfig({ disableWorklist: true }))

    expect(
      await screen.findByText('Worklist has been disabled.'),
    ).toBeInTheDocument()
  })

  it('opens the study from the route', async () => {
    renderAt('/studies/1.2.3')

    expect(await screen.findByText('Case 1.2.3')).toBeInTheDocument()
    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-worklist-button',
      'true',
    )
  })

  it('opens a study addressed by a GCP store path', async () => {
    renderAt('/projects/p/locations/l/datasets/d/dicomStores/s/study/4.5.6')

    expect(await screen.findByText('Case 4.5.6')).toBeInTheDocument()
  })

  it('shows the logout page', async () => {
    renderAt('/logout')

    expect(await screen.findByText('Logged out')).toBeInTheDocument()
  })
})
