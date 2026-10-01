import { fireEvent, render, screen } from '@testing-library/react'

import { SearchInput } from '../search-input'

describe('SearchInput', () => {
  it('reports typed values', () => {
    const onValueChange = jest.fn()
    render(
      <SearchInput
        aria-label="Search"
        value=""
        onValueChange={onValueChange}
      />,
    )
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: 'doe' },
    })
    expect(onValueChange).toHaveBeenCalledWith('doe')
  })

  it('hides the status and clear button without a query', () => {
    render(
      <SearchInput
        aria-label="Search"
        value=""
        onValueChange={jest.fn()}
        status="0 matches"
        clearable
      />,
    )
    expect(screen.queryByText('0 matches')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Clear search' }),
    ).not.toBeInTheDocument()
  })

  it('shows the status and clears the query', () => {
    const onValueChange = jest.fn()
    render(
      <SearchInput
        aria-label="Search"
        value="doe"
        onValueChange={onValueChange}
        status="2 matches"
        clearable
      />,
    )
    expect(screen.getByText('2 matches')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onValueChange).toHaveBeenCalledWith('')
  })

  it('has no clear button unless clearable', () => {
    render(
      <SearchInput aria-label="Search" value="doe" onValueChange={jest.fn()} />,
    )
    expect(
      screen.queryByRole('button', { name: 'Clear search' }),
    ).not.toBeInTheDocument()
  })
})
