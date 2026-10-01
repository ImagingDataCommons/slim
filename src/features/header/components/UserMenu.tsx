import type * as React from 'react'

import type { User } from '../../../auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import { Icon } from '../../../components/ui/icon'
import { cn } from '../../../lib/utils'
import { getUserIdentity } from '../utils/userIdentity'
import type { PreferencesTab } from './dialogs/PreferencesDialog'

interface UserMenuProps {
  user?: User
  organization?: string
  onOpenPreferences: (tab: PreferencesTab) => void
  onLogout?: () => void
}

function MenuItem({
  icon,
  label,
  onSelect,
  danger = false,
}: {
  icon: string
  label: string
  onSelect: () => void
  danger?: boolean
}): React.ReactElement {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className={cn(
        danger
          ? 'text-destructive-text focus:bg-destructive-hover focus:text-destructive-text'
          : 'focus:bg-app',
      )}
    >
      <Icon
        name={icon}
        size={18}
        className={danger ? undefined : 'text-ink-secondary'}
      />
      {label}
    </DropdownMenuItem>
  )
}

export function UserMenu({
  user,
  organization,
  onOpenPreferences,
  onLogout,
}: UserMenuProps): React.ReactElement {
  const { name, email, initials, subline } = getUserIdentity(user, organization)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none transition-colors hover:bg-app focus-visible:ring-2 focus-visible:ring-primary/40 data-[state=open]:bg-app"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
            {initials !== '' ? initials : <Icon name="person" size={16} />}
          </span>
          <span className="flex flex-col items-start leading-[1.2]">
            <span className="text-[12.5px] font-medium text-ink">{name}</span>
            {email !== undefined && (
              <span className="text-[11px] text-ink-muted">{email}</span>
            )}
          </span>
          <Icon name="expand_more" size={18} className="text-ink-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-60">
        <div className="mb-1 border-b border-line-soft px-2.5 pb-2.5 pt-2">
          <div className="font-semibold text-ink">{name}</div>
          {subline !== undefined && (
            <div className="text-[12px] text-ink-muted">{subline}</div>
          )}
        </div>
        <MenuItem
          icon="manage_accounts"
          label="Preferences"
          onSelect={() => onOpenPreferences('general')}
        />
        <MenuItem
          icon="keyboard"
          label="Keyboard shortcuts"
          onSelect={() => onOpenPreferences('keys')}
        />
        <DropdownMenuSeparator />
        <MenuItem
          icon="settings_applications"
          label="Configuration"
          onSelect={() => onOpenPreferences('config')}
        />
        <MenuItem
          icon="info"
          label="About Slim"
          onSelect={() => onOpenPreferences('about')}
        />
        {onLogout !== undefined && (
          <>
            <DropdownMenuSeparator />
            <MenuItem
              icon="logout"
              label="Log out"
              onSelect={onLogout}
              danger
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
