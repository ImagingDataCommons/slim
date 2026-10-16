/**
 * Single source of the viewer keyboard shortcuts, for the viewer key
 * handler, the toolbar tooltips and Preferences > Keyboard shortcuts.
 */

export type ShortcutAction =
  | 'draw'
  | 'modify'
  | 'translate'
  | 'remove'
  | 'toggleRoiVisibility'
  | 'save'
  | 'goTo'

export type ShortcutGroup = 'annotation' | 'navigation'

export interface KeyboardShortcut {
  action: ShortcutAction
  /** `KeyboardEvent.code`, so the shortcut follows the physical key */
  code: string
  /** Key shown to the user */
  key: string
  label: string
  group: ShortcutGroup
}

/** Every shortcut is pressed together with Alt (Option on macOS). */
export const SHORTCUT_MODIFIER = 'Alt'

export const KEYBOARD_SHORTCUTS: readonly KeyboardShortcut[] = [
  {
    action: 'draw',
    code: 'KeyD',
    key: 'D',
    label: 'Draw ROI',
    group: 'annotation',
  },
  {
    action: 'modify',
    code: 'KeyM',
    key: 'M',
    label: 'Modify ROIs',
    group: 'annotation',
  },
  {
    action: 'translate',
    code: 'KeyT',
    key: 'T',
    label: 'Translate ROIs',
    group: 'annotation',
  },
  {
    action: 'remove',
    code: 'KeyR',
    key: 'R',
    label: 'Remove selected ROI',
    group: 'annotation',
  },
  {
    action: 'toggleRoiVisibility',
    code: 'KeyV',
    key: 'V',
    label: 'Show / hide ROIs',
    group: 'annotation',
  },
  {
    action: 'save',
    code: 'KeyS',
    key: 'S',
    label: 'Save ROIs',
    group: 'annotation',
  },
  {
    action: 'goTo',
    code: 'KeyG',
    key: 'G',
    label: 'Go to position',
    group: 'navigation',
  },
]

export const SHORTCUT_GROUP_LABELS: Readonly<Record<ShortcutGroup, string>> = {
  annotation: 'Annotation tools',
  navigation: 'Navigation',
}

export function getShortcut(action: ShortcutAction): KeyboardShortcut {
  const shortcut = KEYBOARD_SHORTCUTS.find((item) => item.action === action)
  if (shortcut === undefined) {
    throw new Error(`No keyboard shortcut for action "${action}"`)
  }
  return shortcut
}

/** "Alt+D" */
export function formatShortcutKeys(action: ShortcutAction): string {
  return `${SHORTCUT_MODIFIER}+${getShortcut(action).key}`
}

/** Tooltip text with the shortcut appended, e.g. "Draw ROI [Alt+D]". */
export function formatShortcutHint(
  action: ShortcutAction,
  label: string = getShortcut(action).label,
): string {
  return `${label} [${formatShortcutKeys(action)}]`
}

/** Shortcuts of each group, in display order, skipping empty groups. */
export function groupShortcuts(
  shortcuts: readonly KeyboardShortcut[] = KEYBOARD_SHORTCUTS,
): Array<{
  group: ShortcutGroup
  label: string
  shortcuts: KeyboardShortcut[]
}> {
  const groups: ShortcutGroup[] = ['annotation', 'navigation']
  return groups
    .map((group) => ({
      group,
      label: SHORTCUT_GROUP_LABELS[group],
      shortcuts: shortcuts.filter((item) => item.group === group),
    }))
    .filter((entry) => entry.shortcuts.length > 0)
}
