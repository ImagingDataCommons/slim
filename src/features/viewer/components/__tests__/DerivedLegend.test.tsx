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

  it('renders nothing without rows', () => {
    const { container } = render(
      <DerivedLegend rows={[]} onVisibilityChange={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
