import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'

import { saveServerSelection } from '../../../../../utils/serverSelectionStorage'
import {
  type ServerSelectionParams,
  useServerSelection,
} from '../../../hooks/useServerSelection'
import { ServerSelectionDialog } from '../ServerSelectionDialog'

const DEFAULT_URL = 'https://proxy.example.org/current/viewer-only/dicomWeb'
const CUSTOM_URL = 'https://other.example.org/dicomweb'
const GCP_URL =
  'https://healthcare.googleapis.com/v1/projects/p/locations/us/datasets/d/dicomStores/s/dicomWeb'

function Harness({
  onServerSelection = () => {},
}: {
  onServerSelection?: (params: ServerSelectionParams) => void
}): React.ReactElement {
  const selection = useServerSelection({ onServerSelection })
  const { openDialog } = selection
  useEffect(() => {
    openDialog()
  }, [openDialog])
  return (
    <ServerSelectionDialog
      selection={selection}
      defaultServerUrl={DEFAULT_URL}
    />
  )
}

const defaultOption = (): HTMLElement =>
  screen.getByRole('radio', { name: /Use default server/ })
const customOption = (): HTMLElement =>
  screen.getByRole('radio', { name: /Use custom server/ })
const urlField = (): HTMLElement => screen.getByLabelText('Server URL')
const okButton = (): HTMLElement => screen.getByRole('button', { name: 'OK' })

describe('ServerSelectionDialog', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('selects the default server and shows its URL', () => {
    render(<Harness />)

    expect(defaultOption()).toBeChecked()
    expect(customOption()).not.toBeChecked()
    expect(screen.getByText(DEFAULT_URL)).toBeInTheDocument()
    expect(screen.queryByLabelText('Server URL')).not.toBeInTheDocument()
    expect(okButton()).toBeEnabled()
  })

  it('connects to the default server on OK', () => {
    const onServerSelection = vi.fn()
    render(<Harness onServerSelection={onServerSelection} />)

    fireEvent.click(okButton())
    expect(onServerSelection).toHaveBeenCalledWith(
      expect.objectContaining({ url: '' }),
    )
  })

  it('connects to a custom Google Cloud store on Enter', () => {
    const onServerSelection = vi.fn()
    render(<Harness onServerSelection={onServerSelection} />)

    fireEvent.click(customOption())
    expect(okButton()).toBeDisabled()
    fireEvent.change(urlField(), { target: { value: GCP_URL } })
    expect(okButton()).toBeEnabled()

    fireEvent.keyDown(urlField(), { key: 'Enter' })
    expect(onServerSelection).toHaveBeenCalledWith(
      expect.objectContaining({ url: GCP_URL }),
    )
  })

  it('offers the remembered custom URL again', () => {
    saveServerSelection(localStorage, { url: CUSTOM_URL, mode: 'default' })
    render(<Harness />)

    expect(defaultOption()).toBeChecked()
    fireEvent.click(customOption())
    expect(urlField()).toHaveValue(CUSTOM_URL)
  })

  it('opens on the custom server when it is the current choice', () => {
    saveServerSelection(localStorage, { url: CUSTOM_URL, mode: 'custom' })
    render(<Harness />)

    expect(customOption()).toBeChecked()
    expect(urlField()).toHaveValue(CUSTOM_URL)
  })

  it('waits for blur before flagging an invalid URL', () => {
    render(<Harness />)
    fireEvent.click(customOption())

    fireEvent.change(urlField(), { target: { value: 'not a url' } })
    expect(urlField()).toHaveAttribute('aria-invalid', 'false')
    expect(okButton()).toBeDisabled()

    fireEvent.blur(urlField())
    expect(urlField()).toHaveAttribute('aria-invalid', 'true')
    expect(urlField()).toHaveAccessibleDescription(/starting with http/)
  })

  it('keeps the dialog open when Enter is pressed on an invalid URL', () => {
    const onServerSelection = vi.fn()
    render(<Harness onServerSelection={onServerSelection} />)
    fireEvent.click(customOption())

    fireEvent.change(urlField(), { target: { value: 'not a url' } })
    fireEvent.keyDown(urlField(), { key: 'Enter' })
    expect(onServerSelection).not.toHaveBeenCalled()
    expect(urlField()).toHaveAttribute('aria-invalid', 'true')
  })

  it('drops line breaks pasted into the URL', () => {
    render(<Harness />)
    fireEvent.click(customOption())

    fireEvent.change(urlField(), {
      target: { value: 'https://example.org/\ndicomweb' },
    })
    expect(urlField()).toHaveValue('https://example.org/dicomweb')
  })

  it('reverts unsaved changes on Cancel', () => {
    const onServerSelection = vi.fn()
    render(<Harness onServerSelection={onServerSelection} />)

    fireEvent.click(customOption())
    fireEvent.change(urlField(), { target: { value: CUSTOM_URL } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onServerSelection).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('flags an invalid OIDC configuration and clears it', () => {
    render(<Harness />)
    const field = screen.getByLabelText('OIDC configuration')

    fireEvent.change(field, { target: { value: '{"authority": ' } })
    expect(field).toHaveAccessibleDescription(/Invalid JSON/)
    expect(okButton()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(field).toHaveValue('')
    expect(okButton()).toBeEnabled()
  })
})
