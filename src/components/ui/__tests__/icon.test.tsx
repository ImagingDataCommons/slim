import { render } from '@testing-library/react'

import { Icon, isIconName } from '../icon'

describe('Icon', () => {
  it('renders a decorative lucide svg at the default size', () => {
    const { container } = render(<Icon name="search" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
    expect(svg).toHaveAttribute('width', '20')
    expect(svg).toHaveAttribute('height', '20')
    expect(svg).toHaveClass('shrink-0')
  })

  it('applies the size and class name', () => {
    const { container } = render(
      <Icon name="close" size={15} className="text-ink-muted" />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '15')
    expect(svg).toHaveClass('text-ink-muted')
  })

  it('tints the shape when filled', () => {
    const { container } = render(<Icon name="info" filled />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('fill', 'currentColor')
    expect(svg).toHaveAttribute('fill-opacity', '0.2')
  })

  it('leaves the shape unfilled by default', () => {
    const { container } = render(<Icon name="info" />)
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'none')
  })
})

describe('isIconName', () => {
  it('accepts mapped names only', () => {
    expect(isIconName('bug_report')).toBe(true)
    expect(isIconName('not_an_icon')).toBe(false)
    expect(isIconName('toString')).toBe(false)
  })
})
