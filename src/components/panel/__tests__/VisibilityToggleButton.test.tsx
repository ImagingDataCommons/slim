import { fireEvent, render, screen } from '@testing-library/react'

import { VisibilityToggleButton } from '../VisibilityToggleButton'

describe('VisibilityToggleButton', () => {
  it('exposes the visibility as a pressed state under a stable name', () => {
    const { rerender } = render(
      <VisibilityToggleButton label="Nuclei" isVisible onChange={jest.fn()} />,
    )
    const button = screen.getByRole('button', { name: 'Show Nuclei' })
    expect(button).toHaveAttribute('aria-pressed', 'true')

    rerender(
      <VisibilityToggleButton
        label="Nuclei"
        isVisible={false}
        onChange={jest.fn()}
      />,
    )
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('requests the opposite visibility on click', () => {
    const onChange = jest.fn()
    render(
      <VisibilityToggleButton label="Nuclei" isVisible onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show Nuclei' }))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('does not toggle when disabled', () => {
    const onChange = jest.fn()
    render(
      <VisibilityToggleButton
        label="Nuclei"
        isVisible={false}
        disabled
        onChange={onChange}
      />,
    )
    const button = screen.getByRole('button', { name: 'Show Nuclei' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onChange).not.toHaveBeenCalled()
  })
})
