import type * as React from 'react'
import { useId, useState } from 'react'

import { Icon } from '../../../components/ui/icon'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover'
import { SearchInput } from '../../../components/ui/search-input'
import { cn } from '../../../lib/utils'
import {
  CONTAINS_GROUPS,
  type ContainsEntry,
  matchContainsEntries,
} from '../utils/containsCatalog'

export interface ContainsPickerProps {
  value?: ContainsEntry
  onChange: (entry: ContainsEntry | undefined) => void
  /** Shown in the chip while the server is searched */
  isBusy?: boolean
}

const TRIGGER_CLASS =
  'inline-flex h-9 items-center gap-1.5 whitespace-nowrap text-13 font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40'

/**
 * "Contains" filter: a searchable list of derived data kinds. Once one is
 * picked it turns into a chip that can be changed or cleared.
 */
export function ContainsPicker({
  value,
  onChange,
  isBusy = false,
}: ContainsPickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = useId()
  const optionIdPrefix = useId()

  const matches = matchContainsEntries(query)
  const activeEntry = matches[Math.min(activeIndex, matches.length - 1)] as
    | ContainsEntry
    | undefined
  const optionId = (entry: ContainsEntry): string =>
    `${optionIdPrefix}-${entry.id}`

  const openChange = (open: boolean): void => {
    setIsOpen(open)
    if (open) {
      setQuery('')
      setActiveIndex(
        Math.max(
          0,
          matchContainsEntries('').findIndex((entry) => entry.id === value?.id),
        ),
      )
    }
  }

  const select = (entry: ContainsEntry): void => {
    onChange(entry)
    setIsOpen(false)
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (matches.length === 0) return
    const current = Math.min(activeIndex, matches.length - 1)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current + 1) % matches.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current - 1 + matches.length) % matches.length)
    } else if (event.key === 'Enter' && activeEntry !== undefined) {
      event.preventDefault()
      select(activeEntry)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={openChange}>
      {value === undefined ? (
        <PopoverTrigger
          className={cn(
            TRIGGER_CLASS,
            'rounded-lg border border-line-input bg-panel px-3 text-ink-body hover:bg-app hover:text-ink',
          )}
        >
          <Icon name="filter_list" size={16} className="text-ink-muted" />
          Contains
          <Icon name="expand_more" size={15} className="text-ink-muted" />
        </PopoverTrigger>
      ) : (
        <div className="inline-flex h-9 items-stretch overflow-hidden rounded-lg border border-primary bg-primary-soft text-primary">
          <PopoverTrigger
            className={cn(
              TRIGGER_CLASS,
              'h-auto pl-3 pr-2 hover:bg-primary/10',
            )}
            aria-label={`Contains ${value.label}. Change`}
          >
            {isBusy ? (
              <span
                aria-hidden
                className="size-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
              />
            ) : (
              <Icon name="filter_list" size={16} />
            )}
            <span className="font-normal text-primary/80">Contains:</span>
            <span className="font-semibold">{value.label}</span>
          </PopoverTrigger>
          <button
            type="button"
            aria-label={`Clear ${value.label} filter`}
            onClick={() => onChange(undefined)}
            className="grid w-8 place-items-center border-l border-primary/25 hover:bg-primary/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-line-soft p-2">
          <SearchInput
            aria-label="Filter derived data"
            placeholder="Parametric map, ANN, SOP Class UID…"
            value={query}
            onValueChange={(next) => {
              setQuery(next)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={
              activeEntry === undefined ? undefined : optionId(activeEntry)
            }
            iconSize={16}
            className="h-8"
          />
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label="Derived data"
          className="max-h-80 overflow-auto p-1"
        >
          {matches.length === 0 && (
            <p className="m-0 px-3 py-6 text-center text-12.5 text-ink-muted">
              Nothing matches “{query.trim()}”.
            </p>
          )}
          {CONTAINS_GROUPS.map((group) => {
            const entries = matches.filter((entry) => entry.group === group)
            if (entries.length === 0) return null
            return (
              <div key={group} role="presentation">
                <div
                  aria-hidden
                  className="px-2.5 pb-1 pt-2 text-11 font-semibold uppercase tracking-wider text-ink-muted"
                >
                  {group}
                </div>
                {entries.map((entry) => {
                  const isActive = entry === activeEntry
                  const isSelected = entry.id === value?.id
                  return (
                    <div
                      key={entry.id}
                      id={optionId(entry)}
                      role="option"
                      tabIndex={-1}
                      aria-selected={isSelected}
                      aria-label={`${entry.label}, ${group}`}
                      onClick={() => select(entry)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        select(entry)
                      }}
                      onMouseMove={() => setActiveIndex(matches.indexOf(entry))}
                      className={cn(
                        'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-13 text-ink-body',
                        isActive && 'bg-selected text-ink',
                      )}
                    >
                      <span className="flex-1 truncate">{entry.label}</span>
                      <span className="rounded-sm bg-chip px-1.5 py-[3px] font-mono text-11 font-semibold leading-none text-chip-foreground">
                        {entry.modality}
                      </span>
                      <Icon
                        name="check"
                        size={15}
                        className={cn(
                          'text-primary',
                          isSelected ? 'visible' : 'invisible',
                        )}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
