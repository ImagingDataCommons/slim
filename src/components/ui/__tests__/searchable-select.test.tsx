import { fireEvent, render, screen, within } from '@testing-library/react'

import { matchOptions, SearchableSelect } from '../searchable-select'

const options = [
  { value: 'all', label: 'All Series (197 segments)' },
  { value: 'til', label: 'TIL Segmentation Inception-V4 (2 segments)' },
  { value: 'nuclei', label: 'Pan-Cancer Nuclei Seg (1 segment)' },
  { value: 'panoptils', label: 'PanopTILs regions (194 segments)' },
]

const renderSelect = (onValueChange = vi.fn()) => {
  render(
    <SearchableSelect
      value="all"
      options={options}
      onValueChange={onValueChange}
      aria-label="Series"
    />,
  )
  return onValueChange
}

describe('matchOptions', () => {
  it('matches every word of the query in any order, ignoring case', () => {
    expect(matchOptions(options, 'segments til').map((o) => o.value)).toEqual([
      'til',
      'panoptils',
    ])
    expect(matchOptions(options, '  ')).toHaveLength(4)
  })
})

describe('SearchableSelect', () => {
  it('shows the selected label and filters the options by typing', () => {
    renderSelect()
    const trigger = screen.getByRole('combobox', { name: 'Series' })
    expect(trigger).toHaveTextContent('All Series (197 segments)')

    fireEvent.click(trigger)
    const filter = screen.getByRole('combobox', {
      name: 'Filter series options',
    })
    expect(filter).toHaveFocus()
    fireEvent.change(filter, { target: { value: 'nuclei' } })
    const listbox = screen.getByRole('listbox', { name: 'Series' })
    expect(within(listbox).getAllByRole('option')).toHaveLength(1)
    expect(screen.getByText('1 of 4')).toBeInTheDocument()

    fireEvent.change(filter, { target: { value: 'missing' } })
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument()
  })

  it('chooses an option with the keyboard', () => {
    const onValueChange = renderSelect()
    fireEvent.click(screen.getByRole('combobox', { name: 'Series' }))
    const filter = screen.getByRole('combobox', {
      name: 'Filter series options',
    })
    /** Matches the nuclei SEG, then PanopTILs */
    fireEvent.change(filter, { target: { value: 'pan' } })
    fireEvent.keyDown(filter, { key: 'ArrowDown' })
    fireEvent.keyDown(filter, { key: 'Enter' })
    expect(onValueChange).toHaveBeenCalledWith('panoptils')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('chooses an option with a click and marks the selected one', () => {
    const onValueChange = renderSelect()
    fireEvent.click(screen.getByRole('combobox', { name: 'Series' }))
    expect(screen.getByRole('option', { name: /All Series/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    fireEvent.click(screen.getByRole('option', { name: /PanopTILs/ }))
    expect(onValueChange).toHaveBeenCalledWith('panoptils')
  })
})
