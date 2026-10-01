import {
  formatShortcutHint,
  formatShortcutKeys,
  getShortcut,
  groupShortcuts,
  KEYBOARD_SHORTCUTS,
} from '../keyboardShortcuts'

describe('KEYBOARD_SHORTCUTS', () => {
  it('binds each action and each key code once', () => {
    const actions = KEYBOARD_SHORTCUTS.map((item) => item.action)
    const codes = KEYBOARD_SHORTCUTS.map((item) => item.code)
    expect(new Set(actions).size).toBe(actions.length)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('shows the letter of the physical key', () => {
    KEYBOARD_SHORTCUTS.forEach((item) => {
      expect(item.code).toBe(`Key${item.key}`)
    })
  })
})

describe('getShortcut', () => {
  it('finds the shortcut of an action', () => {
    expect(getShortcut('draw')).toMatchObject({ code: 'KeyD', key: 'D' })
    expect(getShortcut('goTo')).toMatchObject({ code: 'KeyG', key: 'G' })
  })
})

describe('formatShortcutKeys / formatShortcutHint', () => {
  it('formats the key combination', () => {
    expect(formatShortcutKeys('save')).toBe('Alt+S')
  })

  it('appends the combination to the default or a custom label', () => {
    expect(formatShortcutHint('draw')).toBe('Draw ROI [Alt+D]')
    expect(formatShortcutHint('goTo', 'Go to')).toBe('Go to [Alt+G]')
  })
})

describe('groupShortcuts', () => {
  it('groups shortcuts in display order', () => {
    const groups = groupShortcuts()
    expect(groups.map((entry) => entry.label)).toEqual([
      'Annotation tools',
      'Navigation',
    ])
    expect(groups[0]?.shortcuts).toHaveLength(6)
    expect(groups[1]?.shortcuts.map((item) => item.action)).toEqual(['goTo'])
  })

  it('skips empty groups', () => {
    expect(groupShortcuts([getShortcut('goTo')])).toEqual([
      {
        group: 'navigation',
        label: 'Navigation',
        shortcuts: [getShortcut('goTo')],
      },
    ])
  })
})
