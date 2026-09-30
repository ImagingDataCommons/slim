import * as React from 'react'
import { useState } from 'react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { Icon } from '../../../../components/ui/icon'
import { cn } from '../../../../lib/utils'
import { withOccurrenceKeys } from '../../../../utils/occurrenceKeys'
import type { ExtendedError } from '../../hooks/useNotifications'
import { groupErrorsByCategory } from '../../hooks/useNotifications'

interface DebugDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  errors: ExtendedError[]
  errorCategories: string[]
  warnings: string[]
}

interface DebugCategory {
  key:
    | 'Communication'
    | 'EncodingDecoding'
    | 'Visualization'
    | 'Authentication'
    | 'Warning'
  name: string
  icon: string
  isWarning?: boolean
}

const DEBUG_CATEGORIES: DebugCategory[] = [
  { key: 'Communication', name: 'Communication', icon: 'wifi_off' },
  {
    key: 'EncodingDecoding',
    name: 'Data encoding/decoding',
    icon: 'data_object',
  },
  { key: 'Visualization', name: 'Visualization', icon: 'hide_image' },
  { key: 'Authentication', name: 'Authentication', icon: 'lock' },
  { key: 'Warning', name: 'Warning', icon: 'warning', isWarning: true },
]

interface DebugMessage {
  message: string
  source?: string
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
  return (
    <div className="overflow-hidden rounded-[10px] border border-line">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 bg-panel px-3.5 py-[11px] text-left text-[13px] font-medium text-ink hover:bg-subtle"
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
            'min-w-[22px] rounded-full px-[7px] py-0.5 text-center text-[11px] font-semibold leading-[1.3]',
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
        <div className="flex flex-col border-t border-line-soft bg-subtle">
          {withOccurrenceKeys(messages, (message) => message.message).map(
            ({ item, key }) => (
              <div
                key={key}
                className="flex flex-col gap-[3px] border-b border-line-soft py-2.5 pl-16 pr-3.5 last:border-b-0"
              >
                <span className="break-words text-[12.5px] text-ink">
                  {item.message}
                </span>
                {item.source !== undefined && (
                  <span className="font-mono text-[11px] text-ink-muted">
                    {item.source}
                  </span>
                )}
              </div>
            ),
          )}
          {!hasItems && (
            <div className="pb-3 pl-16 pr-3.5 pt-2.5 text-[12.5px] text-ink-muted">
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
  errorCategories,
  warnings,
}: DebugDialogProps): React.ReactElement {
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(['Communication']),
  )
  const [copied, setCopied] = useState(false)

  const messagesByCategory = React.useMemo(() => {
    const grouped = groupErrorsByCategory(errors, errorCategories)
    const result: Record<DebugCategory['key'], DebugMessage[]> = {
      Communication: [],
      EncodingDecoding: [],
      Visualization: [],
      Authentication: [],
      Warning: warnings.map((message) => ({ message })),
    }
    errors.forEach((error, index) => {
      const key = errorCategories[index] as DebugCategory['key']
      if (key in grouped) {
        result[key].push({ message: error.message, source: error.source })
      }
    })
    return result
  }, [errors, errorCategories, warnings])

  const toggleCategory = (key: string): void => {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const copyReport = (): void => {
    const lines: string[] = [
      '=== Slim Debug Report ===',
      `Generated: ${new Date().toISOString()}`,
      `User agent: ${navigator.userAgent}`,
      '',
    ]
    DEBUG_CATEGORIES.forEach((category) => {
      const messages = messagesByCategory[category.key]
      lines.push(`## ${category.name} (${messages.length})`)
      messages.forEach((item, index) => {
        const source = item.source !== undefined ? ` [${item.source}]` : ''
        lines.push(`  ${index + 1}. ${item.message}${source}`)
      })
      lines.push('')
    })
    void navigator.clipboard?.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[72vh] max-w-[760px]">
        <div className="flex flex-none items-center gap-3.5 border-b border-line pl-5 pr-3 pt-3">
          <div className="flex items-center gap-2.5 pb-3">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-destructive-soft text-destructive-text">
              <Icon name="bug_report" size={19} />
            </span>
            <DialogTitle>Debug</DialogTitle>
          </div>
          <DialogDescription className="ml-1 pb-3 text-[13px]">
            Debug information
          </DialogDescription>
          <div className="flex-1" />
          <div className="pb-2.5">
            <DialogClose className="grid h-8 w-8 place-items-center rounded-lg text-ink-secondary hover:bg-app hover:text-ink">
              <Icon name="close" size={20} />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </div>

        <div className="flex flex-none items-center gap-2 border-b border-line-soft px-5 py-3 text-[12.5px] text-ink-secondary">
          <span className="flex-1">
            Errors and warnings from this session. More detail in the browser
            console.
          </span>
          <button
            type="button"
            onClick={copyReport}
            className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line-input bg-panel px-3 text-[12.5px] font-medium text-ink hover:bg-subtle"
          >
            <Icon
              name={copied ? 'check' : 'content_copy'}
              size={17}
              className={copied ? 'text-success' : undefined}
            />
            {copied ? 'Copied' : 'Copy report'}
          </button>
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
