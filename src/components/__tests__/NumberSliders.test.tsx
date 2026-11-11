import { fireEvent, render, screen } from '@testing-library/react'

import ColorSlider from '../ColorSlider'
import OpacitySlider from '../OpacitySlider'

describe('OpacitySlider', () => {
  it('commits a typed opacity on Enter, not on each keystroke', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(
      <OpacitySlider opacity={0.5} onChange={onChange} onCommit={onCommit} />,
    )
    const field = screen.getByRole('spinbutton', { name: 'Opacity value' })

    fireEvent.change(field, { target: { value: '0' } })
    fireEvent.change(field, { target: { value: '0.75' } })
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(0.75)
    expect(onCommit).toHaveBeenCalledWith(0.75)
  })

  it('clamps to 0-1 and restores the value when the field is left empty', () => {
    const onCommit = vi.fn()
    render(
      <OpacitySlider opacity={0.5} onChange={vi.fn()} onCommit={onCommit} />,
    )
    const field = screen.getByRole('spinbutton', { name: 'Opacity value' })

    fireEvent.change(field, { target: { value: '' } })
    expect(field).toHaveValue(null)
    fireEvent.blur(field)
    expect(onCommit).not.toHaveBeenCalled()
    expect(field).toHaveValue(0.5)

    fireEvent.change(field, { target: { value: '3' } })
    fireEvent.blur(field)
    expect(onCommit).toHaveBeenCalledWith(1)
  })
})

describe('ColorSlider', () => {
  it('commits one channel on blur and keeps the others', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(
      <ColorSlider
        color={[10, 20, 30]}
        onChange={onChange}
        onCommit={onCommit}
      />,
    )
    const green = screen.getByRole('spinbutton', { name: 'Green value' })

    fireEvent.change(green, { target: { value: '2' } })
    fireEvent.change(green, { target: { value: '200' } })
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.blur(green)
    expect(onChange).toHaveBeenCalledWith([10, 200, 30])
    expect(onCommit).toHaveBeenCalledWith([10, 200, 30])
  })

  it('discards a typed value on Escape', () => {
    const onCommit = vi.fn()
    render(
      <ColorSlider
        color={[10, 20, 30]}
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
    )
    const red = screen.getByRole('spinbutton', { name: 'Red value' })

    fireEvent.change(red, { target: { value: '99' } })
    fireEvent.keyDown(red, { key: 'Escape' })
    fireEvent.blur(red)
    expect(onCommit).not.toHaveBeenCalled()
    expect(red).toHaveValue(10)
  })
})
