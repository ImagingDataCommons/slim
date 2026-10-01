import type * as React from 'react'
import { useId, useMemo, useState } from 'react'

import { CopyButton } from '../../../../components/ui/copy-button'
import {
  Dialog,
  DialogContent,
  SlimDialogHeader,
} from '../../../../components/ui/dialog'
import { Icon } from '../../../../components/ui/icon'
import { cn } from '../../../../lib/utils'
import { withOccurrenceKeys } from '../../../../utils/occurrenceKeys'
import type { ErrorNotification } from '../../hooks/useNotifications'
import {
  buildDebugMessages,
  DEBUG_CATEGORIES,
  type DebugCategory,
  type DebugCategoryKey,
  type DebugMessage,
  formatDebugReport,
} from '../../utils/debugReport'

export interface DebugDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  errors: readonly ErrorNotification[]
  warnings: readonly string[]
}

function DebugCategoryCard({
  category,
  messages,
  isOpen,
  onToggle,
}: {
  category: DebugCategory
  messages: DebugMessage[]
  isOpen: boolean
  onToggle: () => void
}): React.ReactElement {
  const count = messages.length
  const hasItems = count > 0
  const panelId = useId()
  return (
    <div className="overflow-hidden rounded-card border border-line">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 bg-panel px-3.5 py-[11px] text-left text-13 font-medium text-ink hover:bg-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
      >
        <Icon
          name={isOpen ? 'expand_more' : 'chevron_right'}
          size={18}
          className="text-ink-faint"
        />
        <Icon
          name={category.icon}
          size={18}
          className={cn(
            !hasItems && 'text-ink-faint',
            hasItems &&
              (category.isWarning === true
                ? 'text-warning'
                : 'text-destructive'),
          )}
        />
        <span className="flex-1">{category.name}</span>
        <span
          className={cn(
            'min-w-[22px] rounded-full px-[7px] py-0.5 text-center text-11 font-semibold leading-[1.3]',
            !hasItems && 'bg-line-soft text-ink-muted',
            hasItems &&
              (category.isWarning === true
                ? 'bg-warning-soft text-warning-text'
                : 'bg-destructive-soft text-destructive-text'),
          )}
        >
          {count}
        </span>
      </button>
      {isOpen && (
        <div
          id={panelId}
          className="flex flex-col border-t border-line-soft bg-subtle"
        >
          {withOccurrenceKeys(messages, (message) => message.message).map(
            ({ item, key }) => (
              <div
                key={key}
                className="flex flex-col gap-[3px] border-b border-line-soft py-2.5 pl-16 pr-3.5 last:border-b-0"
              >
                <span className="wrap-break-word text-12.5 text-ink">
                  {item.message}
                </span>
                {item.source !== undefined && (
                  <span className="font-mono text-11 text-ink-muted">
                    {item.source}
                  </span>
                )}
              </div>
            ),
          )}
          {!hasItems && (
            <div className="pb-3 pl-16 pr-3.5 pt-2.5 text-12.5 text-ink-muted">
              Nothing reported.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DebugDialog({
  open,
  onOpenChange,
  errors,
  warnings,
}: DebugDialogProps): React.ReactElement {
  const [openCategories, setOpenCategories] = useState<
    ReadonlySet<DebugCategoryKey>
  >(() => new Set<DebugCategoryKey>(['Communication']))

  const messagesByCategory = useMemo(
    () => buildDebugMessages(errors, warnings),
    [errors, warnings],
  )

  const toggleCategory = (key: DebugCategoryKey): void => {
    setOpenCategories((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[72vh] max-w-[760px]">
        <SlimDialogHeader
          icon="bug_report"
          tone="destructive"
          title="Debug"
          subtitle="Errors and warnings from this session"
        />

        <div className="flex flex-none items-center gap-2 border-b border-line-soft px-5 py-3 text-12.5 text-ink-secondary">
          <span className="flex-1">More detail in the browser console.</span>
          <CopyButton
            text={() =>
              formatDebugReport(
                messagesByCategory,
                new Date(),
                navigator.userAgent,
              )
            }
            label="Copy report"
            size="sm"
            iconSize={17}
            className="h-8 rounded-lg px-3 text-ink"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-5 pb-5 pt-4">
          {DEBUG_CATEGORIES.map((category) => (
            <DebugCategoryCard
              key={category.key}
              category={category}
              messages={messagesByCategory[category.key]}
              isOpen={openCategories.has(category.key)}
              onToggle={() => toggleCategory(category.key)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
