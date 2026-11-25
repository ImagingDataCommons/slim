import { fireEvent, render, screen } from '@testing-library/react'

import type { DerivedLegendRow } from '../../utils/derivedLegend'
import { DerivedLegend } from '../DerivedLegend'

const row = (isVisible: boolean): DerivedLegendRow => ({
  id: 'seg-1',
  kind: 'segment',
  title: 'Necrosis',
  palette: {
    data: [
      [0, 0, 0],
      [255, 255, 255],
    ],
  } as never,
  minLabel: '0',
  maxLabel: '1',
  isVisible,
})

describe('DerivedLegend', () => {
  it('stays listed with every overlay hidden so it can turn one back on', () => {
    const onVisibilityChange = vi.fn()
    render(
      <DerivedLegend
        rows={[row(false)]}
        onVisibilityChange={onVisibilityChange}
      />,
    )

    expect(
      screen.getByRole('list', { name: 'Overlay color legend' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Necrosis/ }))
    expect(onVisibilityChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'seg-1' }),
      true,
    )
  })

  it('collapses to a header that counts the visible overlays', () => {
    const onCollapsedChange = vi.fn()
    const { rerender } = render(
      <DerivedLegend
        rows={[row(true), { ...row(false), id: 'seg-2' }]}
        onVisibilityChange={vi.fn()}
        onCollapsedChange={onCollapsedChange}
      />,
    )

    const header = screen.getByRole('button', { name: 'Legend' })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(header)
    expect(onCollapsedChange).toHaveBeenCalledWith(true)

    rerender(
      <DerivedLegend
        rows={[row(true), { ...row(false), id: 'seg-2' }]}
        onVisibilityChange={vi.fn()}
        collapsed
        onCollapsedChange={onCollapsedChange}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Legend (1 visible)' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('list', { name: 'Overlay color legend' }),
    ).not.toBeInTheDocument()
    /** The controlled list stays in the DOM, hidden */
    const collapsedHeader = screen.getByRole('button', {
      name: 'Legend (1 visible)',
    })
    const list = document.getElementById(
      collapsedHeader.getAttribute('aria-controls') ?? '',
    )
    expect(list).not.toBeNull()
    expect(list).not.toBeVisible()
  })

  it('renders nothing without rows', () => {
    const { container } = render(
      <DerivedLegend rows={[]} onVisibilityChange={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
