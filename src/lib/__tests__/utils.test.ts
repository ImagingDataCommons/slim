import { cn } from '../utils'

describe('cn', () => {
  it('lets later utilities win within the same group', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('drops falsy conditional classes', () => {
    expect(cn('flex', false, undefined, null, 'gap-2')).toBe('flex gap-2')
  })

  it('keeps a custom font size next to a custom text color', () => {
    expect(cn('text-12', 'text-ink')).toBe('text-12 text-ink')
    expect(cn('text-12.5 text-ink-muted', 'text-primary')).toBe(
      'text-12.5 text-primary',
    )
  })

  it('merges custom font sizes with each other and with arbitrary sizes', () => {
    expect(cn('text-12', 'text-13')).toBe('text-13')
    expect(cn('text-[15px]', 'text-11.5')).toBe('text-11.5')
  })

  it.each([
    '11',
    '11.5',
    '12',
    '12.5',
    '13',
  ])('keeps the custom text-%s size next to a color', (size) => {
    expect(cn(`text-${size}`, 'text-ink')).toBe(`text-${size} text-ink`)
    expect(cn('text-sm', `text-${size}`)).toBe(`text-${size}`)
  })

  it('merges custom radius and control height tokens', () => {
    expect(cn('rounded-card', 'rounded-lg')).toBe('rounded-lg')
    expect(cn('rounded-lg', 'rounded-tile')).toBe('rounded-tile')
    expect(cn('rounded-card', 'rounded-tile')).toBe('rounded-tile')
    expect(cn('h-control', 'h-8')).toBe('h-8')
    expect(cn('h-9', 'h-control')).toBe('h-control')
  })

  it('treats control as a spacing token for every spacing utility', () => {
    expect(cn('w-8', 'w-control')).toBe('w-control')
    expect(cn('size-control', 'size-6')).toBe('size-6')
    expect(cn('min-h-control', 'min-h-0')).toBe('min-h-0')
  })

  it('keeps custom sizes when combined with unrelated utilities', () => {
    expect(cn('rounded-card h-control text-12.5', 'px-2')).toBe(
      'rounded-card h-control text-12.5 px-2',
    )
  })

  it('treats design color tokens as colors', () => {
    expect(cn('bg-panel', 'bg-subtle')).toBe('bg-subtle')
  })

  it.each([
    'segmented',
    'tool',
    'overlay',
    'menu',
    'modal',
    'selected-ring',
  ])('treats shadow-%s as a box shadow, not a shadow color', (name) => {
    expect(cn('shadow-sm', `shadow-${name}`)).toBe(`shadow-${name}`)
    expect(cn(`shadow-${name}`, 'shadow-none')).toBe('shadow-none')
    expect(cn(`shadow-${name}`, 'shadow-primary')).toBe(
      `shadow-${name} shadow-primary`,
    )
  })

  it('merges custom shadow tokens with each other', () => {
    expect(cn('shadow-segmented', 'shadow-menu')).toBe('shadow-menu')
  })

  it('merges layout width and height tokens with other sizes', () => {
    expect(cn('w-sidebar', 'w-72')).toBe('w-72')
    expect(cn('w-sidebar', 'w-sidebar-right')).toBe('w-sidebar-right')
    expect(cn('h-8', 'h-header')).toBe('h-header')
    expect(cn('h-header', 'h-toolbar', 'h-footer')).toBe('h-footer')
    expect(cn('w-sidebar', 'h-header')).toBe('w-sidebar h-header')
  })

  it('merges Tailwind v4 renamed utilities', () => {
    expect(cn('rounded-sm', 'rounded-card')).toBe('rounded-card')
    expect(cn('rounded-xs', 'rounded-sm')).toBe('rounded-sm')
    expect(cn('shadow-xs', 'shadow-menu')).toBe('shadow-menu')
    expect(cn('outline-hidden', 'outline-none')).toBe('outline-none')
    expect(cn('bg-linear-to-r/srgb', 'bg-linear-to-br/srgb')).toBe(
      'bg-linear-to-br/srgb',
    )
  })
})
