import * as React from 'react'

import { Icon } from '../../../components/ui/icon'
import { cn } from '../../../lib/utils'
import type { PreferencesTabDefinition } from '../utils/preferencesTabs'

export interface NavButtonProps {
  tab: PreferencesTabDefinition
  isActive: boolean
  id: string
  panelId: string
  onSelect: () => void
}

/** One `role="tab"` entry of the Preferences sidebar (roving tabindex). */
export const NavButton = React.forwardRef<HTMLButtonElement, NavButtonProps>(
  ({ tab, isActive, id, panelId, onSelect }, ref) => (
    <button
      ref={ref}
      id={id}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-13 font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40',
        isActive
          ? 'bg-segmented-active text-primary shadow-[0_1px_2px_rgb(var(--shadow-color)/0.1)]'
          : 'text-ink-secondary hover:text-ink',
      )}
    >
      <Icon name={tab.icon} size={18} />
      {tab.label}
    </button>
  ),
)
NavButton.displayName = 'NavButton'
