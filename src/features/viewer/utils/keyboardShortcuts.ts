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

/** With `disableAnnotationTools`, only the shortcuts of the remaining toolbar buttons work */
export function isShortcutEnabled(
  action: ViewerShortcutAction,
  enableAnnotationTools: boolean,
): boolean {
  return enableAnnotationTools || action === 'cancel' || action === 'goTo'
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

const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]'

/** Whether a key event happened inside an open dialog */
export function isInsideDialog(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return false
  }
  return target.closest(DIALOG_SELECTOR) !== null
}
