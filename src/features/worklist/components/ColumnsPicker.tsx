import type * as React from 'react'
import { useId, useState } from 'react'

import { Checkbox } from '../../../components/ui/checkbox'
import { Icon } from '../../../components/ui/icon'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover'
import { cn } from '../../../lib/utils'
import {
  loadPreferences,
  savePreferences,
} from '../../preferences/utils/preferences'
import type { WorklistWidthTier } from '../hooks/useWorklistColumnLayout'
import { WORKLIST_COLUMNS_BY_TIER } from '../hooks/useWorklistColumnLayout'
import {
  sanitizeHiddenColumnIds,
  WORKLIST_COLUMN_IDS,
  WORKLIST_COLUMN_LABELS,
  WORKLIST_LOCKED_COLUMN_ID,
  type WorklistColumnId,
} from '../utils/worklistColumns'

export interface ColumnsPickerProps {
  /** Current width tier; columns outside this set are listed but disabled. */
  tier: WorklistWidthTier
  hiddenColumnIds: readonly string[]
  className?: string
}

const TRIGGER_CLASS =
  'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line-input bg-panel px-3 text-13 font-medium text-ink-body transition-colors hover:bg-app hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40'

/**
 * Popover checklist for worklist columns. Width shedding still caps what can
 * appear; this only hides extras within the eligible set.
 */
export function ColumnsPicker({
  tier,
  hiddenColumnIds,
  className,
}: ColumnsPickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const idPrefix = useId()
  const eligible = new Set(WORKLIST_COLUMNS_BY_TIER[tier])
  const hidden = new Set(sanitizeHiddenColumnIds(hiddenColumnIds))

  const setHidden = (nextHidden: readonly WorklistColumnId[]): void => {
    const preferences = loadPreferences()
    savePreferences({
      ...preferences,
      worklistHiddenColumnIds: sanitizeHiddenColumnIds(nextHidden),
    })
  }

  const toggle = (id: WorklistColumnId, show: boolean): void => {
    if (id === WORKLIST_LOCKED_COLUMN_ID) return
    if (!eligible.has(id)) return
    if (show) {
      setHidden([...hidden].filter((columnId) => columnId !== id))
    } else {
      setHidden([...hidden, id])
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className={cn(TRIGGER_CLASS, className)}
        aria-label="Choose worklist columns"
      >
        <Icon name="tune" size={16} className="text-ink-muted" />
        Columns
        <Icon name="expand_more" size={15} className="text-ink-muted" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b border-line-soft px-3 py-2 text-11 font-semibold uppercase tracking-wider text-ink-muted">
          Columns
        </div>
        <ul className="m-0 max-h-80 list-none overflow-auto p-1">
          {WORKLIST_COLUMN_IDS.map((id) => {
            const isLocked = id === WORKLIST_LOCKED_COLUMN_ID
            const isEligible = eligible.has(id)
            const isShown = isEligible && (isLocked || !hidden.has(id))
            const disabled = isLocked || !isEligible
            const label = WORKLIST_COLUMN_LABELS[id]
            const hint = !isEligible
              ? 'Widen the window to show this column'
              : isLocked
                ? 'Always shown'
                : undefined
            const inputId = `${idPrefix}-${id}`
            return (
              <li key={id}>
                <label
                  htmlFor={inputId}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-13 text-ink-body',
                    disabled && 'cursor-not-allowed opacity-55',
                    !disabled && 'hover:bg-selected',
                  )}
                  title={hint}
                >
                  <Checkbox
                    id={inputId}
                    checked={isShown}
                    disabled={disabled}
                    aria-label={label}
                    onCheckedChange={(value) => {
                      toggle(id, value === true)
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
