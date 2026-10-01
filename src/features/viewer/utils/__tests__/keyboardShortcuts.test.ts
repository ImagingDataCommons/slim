import { KEYBOARD_SHORTCUTS } from '../../../../utils/keyboardShortcuts'
import { ALT_SHORTCUTS, shortcutForKeyEvent } from '../keyboardShortcuts'

const keyEvent = (
  overrides: Partial<Parameters<typeof shortcutForKeyEvent>[0]>,
) => ({
  key: '',
  code: '',
  altKey: false,
  target: document.body,
  ...overrides,
})

describe('ALT_SHORTCUTS', () => {
  it('maps the code of every keyboard shortcut to its action', () => {
    expect(Object.keys(ALT_SHORTCUTS)).toHaveLength(KEYBOARD_SHORTCUTS.length)
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(ALT_SHORTCUTS[shortcut.code]).toBe(shortcut.action)
    }
  })
})

describe('shortcutForKeyEvent', () => {
  it('maps every Alt shortcut', () => {
    for (const [code, action] of Object.entries(ALT_SHORTCUTS)) {
      expect(shortcutForKeyEvent(keyEvent({ code, altKey: true }))).toBe(action)
    }
  })

  it('requires Alt for letter shortcuts', () => {
    expect(shortcutForKeyEvent(keyEvent({ code: 'KeyD' }))).toBeUndefined()
  })

  it('ignores unknown codes', () => {
    expect(
      shortcutForKeyEvent(keyEvent({ code: 'KeyZ', altKey: true })),
    ).toBeUndefined()
    expect(
      shortcutForKeyEvent(keyEvent({ code: 'toString', altKey: true })),
    ).toBeUndefined()
  })

  it('cancels on Escape, even inside a field', () => {
    const input = document.createElement('input')
    expect(shortcutForKeyEvent(keyEvent({ key: 'Escape' }))).toBe('cancel')
    expect(
      shortcutForKeyEvent(keyEvent({ key: 'Escape', target: input })),
    ).toBe('cancel')
  })

  it('ignores Alt shortcuts while typing in a field', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      const target = document.createElement(tag)
      expect(
        shortcutForKeyEvent(keyEvent({ code: 'KeyD', altKey: true, target })),
      ).toBeUndefined()
    }
  })

  it('treats a null target like the page', () => {
    expect(
      shortcutForKeyEvent(
        keyEvent({ code: 'KeyG', altKey: true, target: null }),
      ),
    ).toBe('goTo')
  })
})
