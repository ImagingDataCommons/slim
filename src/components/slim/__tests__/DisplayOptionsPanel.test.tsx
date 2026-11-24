import { fireEvent, render, screen } from '@testing-library/react'

import type { DisplayOption } from '../DisplayOptionsPanel'
import { DisplayOptionsPanel } from '../DisplayOptionsPanel'

function renderPanel(options: DisplayOption[]): void {
  render(<DisplayOptionsPanel options={options} />)
  fireEvent.click(screen.getByRole('button', { name: /^Display options/ }))
}

const iccOption = (overrides: Partial<DisplayOption>): DisplayOption => ({
  id: 'icc',
  label: 'ICC profiles',
  description: 'Apply the embedded color profile.',
  enabled: true,
  onChange: vi.fn(),
  ...overrides,
})

describe('DisplayOptionsPanel', () => {
  it('keeps a busy switch checked, focused and locked', () => {
    const onChange = vi.fn()
    renderPanel([iccOption({ disabled: true, busy: true, onChange })])
    const icc = screen.getByRole('switch', { name: 'ICC profiles' })
    icc.focus()

    expect(icc).toBeChecked()
    expect(icc).toHaveAttribute('aria-disabled', 'true')
    expect(icc).toHaveAttribute('aria-busy', 'true')
    expect(icc).not.toBeDisabled()
    expect(icc).toHaveFocus()

    fireEvent.click(icc)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows an unavailable switch as off and ignores it', () => {
    const onChange = vi.fn()
    renderPanel([iccOption({ disabled: true, onChange })])
    const icc = screen.getByRole('switch', { name: 'ICC profiles' })

    expect(icc).not.toBeChecked()
    expect(icc).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(icc)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('toggles an available switch', () => {
    const onChange = vi.fn()
    renderPanel([iccOption({ enabled: false, onChange })])

    fireEvent.click(screen.getByRole('switch', { name: 'ICC profiles' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
