import type { IconName } from '../../../components/ui/icon'

export type PreferencesTab =
  | 'general'
  | 'annotations'
  | 'keys'
  | 'config'
  | 'about'

export interface PreferencesTabDefinition {
  id: PreferencesTab
  label: string
  icon: IconName
  /** Header subtitle while the tab is active */
  subtitle: string
  /** Edits a draft saved with the footer button; read-only tabs have none */
  isEditable: boolean
}

const USER_SUBTITLE = 'Saved to your profile on this device'

export const USER_TABS: readonly PreferencesTabDefinition[] = [
  {
    id: 'general',
    label: 'General',
    icon: 'settings',
    subtitle: USER_SUBTITLE,
    isEditable: true,
  },
  {
    id: 'annotations',
    label: 'Annotations',
    icon: 'polyline',
    subtitle: USER_SUBTITLE,
    isEditable: true,
  },
  {
    id: 'keys',
    label: 'Keyboard shortcuts',
    icon: 'keyboard',
    subtitle: USER_SUBTITLE,
    isEditable: true,
  },
]

export const APP_TABS: readonly PreferencesTabDefinition[] = [
  {
    id: 'config',
    label: 'Configuration',
    icon: 'settings_applications',
    subtitle: 'Read-only deployment settings',
    isEditable: false,
  },
  {
    id: 'about',
    label: 'About Slim',
    icon: 'info',
    subtitle: 'Version and build information',
    isEditable: false,
  },
]

export const ALL_TABS: readonly PreferencesTabDefinition[] = [
  ...USER_TABS,
  ...APP_TABS,
]

export function getTabDefinition(
  tab: PreferencesTab,
): PreferencesTabDefinition {
  return ALL_TABS.find((item) => item.id === tab) ?? ALL_TABS[0]
}

/**
 * Tab selected by a key in a vertical tablist (WAI-ARIA tabs pattern):
 * arrows wrap around, Home/End jump to the ends; other keys return undefined.
 */
export function getTabForKey(
  tabs: readonly PreferencesTabDefinition[],
  current: PreferencesTab,
  key: string,
): PreferencesTab | undefined {
  const index = tabs.findIndex((tab) => tab.id === current)
  if (index === -1 || tabs.length === 0) return undefined
  let next: number
  switch (key) {
    case 'ArrowDown':
      next = (index + 1) % tabs.length
      break
    case 'ArrowUp':
      next = (index - 1 + tabs.length) % tabs.length
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = tabs.length - 1
      break
    default:
      return undefined
  }
  return tabs[next]?.id
}
