import { fireEvent, render, screen } from '@testing-library/react'

import { Slider } from '../slider'

describe('Slider', () => {
  it('names the thumb and forwards value changes and commits', () => {
    const onValueChange = vi.fn()
    const onValueCommit = vi.fn()
    render(
      <Slider
        aria-label="Opacity"
        min={0}
        max={10}
        step={1}
        defaultValue={[5]}
        onValueChange={onValueChange}
        onValueCommit={onValueCommit}
      />,
    )
    const thumb = screen.getByRole('slider', { name: 'Opacity' })
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(onValueChange).toHaveBeenCalledWith([6])
    expect(onValueCommit).toHaveBeenCalledWith([6])
  })

  it('labels each thumb of a range', () => {
    render(
      <Slider
        thumbLabels={['Lower limit', 'Upper limit']}
        defaultValue={[2, 8]}
        max={10}
      />,
    )
    expect(
      screen.getByRole('slider', { name: 'Lower limit' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('slider', { name: 'Upper limit' }),
    ).toBeInTheDocument()
  })

  it('falls back to aria-labelledby without a label', () => {
    render(
      <>
        <span id="width-label">Stroke width</span>
        <Slider aria-labelledby="width-label" defaultValue={[2]} max={6} />
      </>,
    )
    expect(
      screen.getByRole('slider', { name: 'Stroke width' }),
    ).toBeInTheDocument()
  })
})
