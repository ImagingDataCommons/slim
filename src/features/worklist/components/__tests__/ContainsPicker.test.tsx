import { fireEvent, render, screen } from '@testing-library/react'

import { findContainsEntry } from '../../utils/containsCatalog'
import { ContainsPicker } from '../ContainsPicker'

const openPicker = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /Contains/ }))
}
const filterField = (): HTMLElement =>
  screen.getByRole('combobox', { name: 'Filter derived data' })

describe('ContainsPicker', () => {
  it('lists the catalog grouped by kind', () => {
    render(<ContainsPicker onChange={() => {}} />)
    openPicker()

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Parametric map, Maps' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(10)
  })

  it('filters while typing and picks the first match on Enter', () => {
    const onChange = vi.fn()
    render(<ContainsPicker onChange={onChange} />)
    openPicker()

    fireEvent.change(filterField(), { target: { value: 'heat' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    fireEvent.keyDown(filterField(), { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(findContainsEntry('pmap'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('moves the active option with the arrow keys', () => {
    const onChange = vi.fn()
    render(<ContainsPicker onChange={onChange} />)
    openPicker()

    fireEvent.change(filterField(), { target: { value: 'seg' } })
    fireEvent.keyDown(filterField(), { key: 'ArrowDown' })
    expect(filterField()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Label map/ }).id,
    )
    fireEvent.keyDown(filterField(), { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(findContainsEntry('labelmap'))
  })

  it('says when nothing matches', () => {
    render(<ContainsPicker onChange={() => {}} />)
    openPicker()

    fireEvent.change(filterField(), { target: { value: 'ultrasound' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument()
  })

  it('shows the picked entry as a clearable chip', () => {
    const onChange = vi.fn()
    render(
      <ContainsPicker value={findContainsEntry('ann')} onChange={onChange} />,
    )

    expect(
      screen.getByRole('button', { name: 'Contains Bulk annotations. Change' }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear Bulk annotations filter' }),
    )
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('marks the picked entry in the list', () => {
    render(
      <ContainsPicker value={findContainsEntry('ann')} onChange={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Change/ }))

    expect(
      screen.getByRole('option', { name: 'Bulk annotations, Annotations' }),
    ).toHaveAttribute('aria-selected', 'true')
  })
})
