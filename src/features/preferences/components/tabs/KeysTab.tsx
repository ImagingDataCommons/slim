import type * as React from 'react'

import {
  groupShortcuts,
  SHORTCUT_MODIFIER,
} from '../../../../utils/keyboardShortcuts'
import { SectionLabel } from '../PreferenceRow'

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd className="min-w-[26px] rounded-[5px] border border-b-2 border-line-input bg-panel px-[7px] py-[3px] text-center font-mono text-11.5 font-medium text-ink-body">
      {children}
    </kbd>
  )
}

const SHORTCUT_GROUPS = groupShortcuts()

export function KeysTab(): React.ReactElement {
  return (
    <>
      {SHORTCUT_GROUPS.map(({ group, label, shortcuts }) => (
        <section key={group}>
          <SectionLabel>{label}</SectionLabel>
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex items-center border-b border-line-soft py-2.5"
            >
              <span className="flex-1 text-ink">{shortcut.label}</span>
              <span className="flex gap-1">
                <Kbd>{SHORTCUT_MODIFIER}</Kbd>
                <Kbd>{shortcut.key}</Kbd>
              </span>
            </div>
          ))}
        </section>
      ))}
    </>
  )
}
