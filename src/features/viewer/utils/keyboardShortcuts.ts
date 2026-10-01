import {
  KEYBOARD_SHORTCUTS,
  type ShortcutAction,
} from '../../../utils/keyboardShortcuts'

export type ViewerShortcutAction = ShortcutAction | 'cancel'

/** Alt + key shortcuts, keyed by `KeyboardEvent.code` */
export const ALT_SHORTCUTS: Readonly<Record<string, ShortcutAction>> =
  Object.fromEntries(
    KEYBOARD_SHORTCUTS.map((shortcut) => [shortcut.code, shortcut.action]),
  )

export interface ShortcutKeyEvent {
  key: string
  code: string
  altKey: boolean
  target: EventTarget | null
}

const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false
  }
  return TEXT_ENTRY_TAGS.has(target.tagName) || target.isContentEditable
}

/**
 * Viewer action for a key-up event. Escape always cancels; Alt shortcuts are
 * ignored while typing in a field, where Alt combinations produce characters
 * on some keyboard layouts.
 */
export function shortcutForKeyEvent(
  event: ShortcutKeyEvent,
): ViewerShortcutAction | undefined {
  if (event.key === 'Escape') return 'cancel'
  if (!event.altKey || isTextEntryTarget(event.target)) return undefined
  return Object.hasOwn(ALT_SHORTCUTS, event.code)
    ? ALT_SHORTCUTS[event.code]
    : undefined
}
