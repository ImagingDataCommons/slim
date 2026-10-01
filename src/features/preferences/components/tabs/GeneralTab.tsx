import type * as React from 'react'

import { SegmentedControl } from '../../../../components/ui/segmented'
import { Switch } from '../../../../components/ui/switch'
import type { Theme } from '../../../../contexts/ThemeContext'
import type { UserPreferences } from '../../utils/preferences'
import { PreferenceRow, SectionLabel } from '../PreferenceRow'

const THEME_OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export interface GeneralTabProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  draft: UserPreferences
  onChange: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void
}

export function GeneralTab({
  theme,
  onThemeChange,
  draft,
  onChange,
}: GeneralTabProps): React.ReactElement {
  return (
    <>
      <SectionLabel>Appearance</SectionLabel>
      <div className="flex flex-col gap-2 border-b border-line-soft pb-3.5 pt-2.5">
        <div className="font-medium text-ink">Theme</div>
        <SegmentedControl
          fill
          aria-label="Theme"
          value={theme}
          onChange={onThemeChange}
          options={THEME_OPTIONS}
        />
      </div>
      <SectionLabel>Worklist</SectionLabel>
      <PreferenceRow
        label="Compact rows"
        description="Show more studies per page"
      >
        {(controlProps) => (
          <Switch
            {...controlProps}
            size="lg"
            checked={draft.compactRows}
            onCheckedChange={(value) => onChange('compactRows', value)}
          />
        )}
      </PreferenceRow>
      <PreferenceRow
        label="Remember filters"
        description="Keep the date filter between sessions"
      >
        {(controlProps) => (
          <Switch
            {...controlProps}
            size="lg"
            checked={draft.rememberFilters}
            onCheckedChange={(value) => onChange('rememberFilters', value)}
          />
        )}
      </PreferenceRow>
    </>
  )
}
