/** skipcq: JS-C1003 */
import * as React from 'react'

import { cn } from '../../lib/utils'
import { Icon } from './icon'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { SearchInput } from './search-input'

export interface SearchableSelectOption {
  value: string
  label: string
}

export interface SearchableSelectProps {
  value: string
  options: readonly SearchableSelectOption[]
  onValueChange: (value: string) => void
  /** Names the trigger, which shows the selected option's label */
  'aria-label': string
  placeholder?: string
  /** Placeholder of the filter field */
  searchPlaceholder?: string
  triggerClassName?: string
}

/** Options whose label contains every word of `query`, ignoring case */
export function matchOptions<T extends SearchableSelectOption>(
  options: readonly T[],
  query: string,
): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...options]
  return options.filter((option) => {
    const label = option.label.toLowerCase()
    return words.every((word) => label.includes(word))
  })
}

/**
 * Select whose options can be filtered by typing: a trigger like the other
 * selects, opening a filter field over the list. For lists long enough that
 * scrolling to an option is slow, e.g. the series of a study.
 */
export function SearchableSelect({
  value,
  options,
  onValueChange,
  'aria-label': ariaLabel,
  placeholder = 'Select',
  searchPlaceholder = 'Filter',
  triggerClassName,
}: SearchableSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const listId = React.useId()
  const optionIdPrefix = React.useId()

  const selected = options.find((option) => option.value === value)
  const matches = matchOptions(options, query)
  const active = matches[Math.min(activeIndex, matches.length - 1)] as
    | SearchableSelectOption
    | undefined
  const optionId = (index: number): string => `${optionIdPrefix}-${index}`
  const activeId =
    active === undefined ? undefined : optionId(matches.indexOf(active))

  /** Keep the active option in view while moving with the arrow keys */
  React.useEffect(() => {
    if (!isOpen || activeId === undefined) return
    const element = document.getElementById(activeId)
    element?.scrollIntoView?.({ block: 'nearest' })
  }, [isOpen, activeId])

  /** Open on the selected option, or filtered by `initialQuery` */
  const open = (initialQuery = ''): void => {
    setIsOpen(true)
    setQuery(initialQuery)
    setActiveIndex(
      initialQuery === ''
        ? Math.max(
            0,
            options.findIndex((option) => option.value === value),
          )
        : 0,
    )
  }

  const openChange = (next: boolean): void => {
    if (next) open()
    else setIsOpen(false)
  }

  /**
   * Like the select it replaces: the arrow keys open the list, and typing on
   * the closed trigger opens it filtered by what was typed
   */
  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (isOpen) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      open()
    } else if (
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault()
      open(event.key)
    }
  }

  const choose = (option: SearchableSelectOption): void => {
    setIsOpen(false)
    if (option.value !== value) onValueChange(option.value)
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
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(matches.length - 1)
    } else if (event.key === 'Enter' && active !== undefined) {
      event.preventDefault()
      choose(active)
    }
  }

  return (
    /**
     * Modal, so the list keeps its own scrolling inside a modal sheet, whose
     * scroll lock would otherwise block wheel and touch scrolling in it
     */
    <Popover open={isOpen} onOpenChange={openChange} modal>
      <PopoverTrigger
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'flex h-control w-full items-center justify-between gap-2 rounded-lg border border-line-input bg-panel pl-2.5 pr-2 text-left text-13 text-ink focus:outline-hidden focus:border-primary focus:ring-[3px] focus:ring-primary/15',
          triggerClassName,
        )}
      >
        <span
          className={cn(
            'line-clamp-1',
            selected === undefined && 'text-ink-fainter',
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <Icon
          name="expand_more"
          size={18}
          aria-hidden
          className="flex-none text-ink-muted"
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        /** No taller than the room Radix finds beside the trigger */
        className="flex max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) min-w-64 flex-col p-0"
        onOpenAutoFocus={(event) => {
          /** Focus the filter field, not the first option */
          event.preventDefault()
          const input =
            event.currentTarget instanceof HTMLElement
              ? event.currentTarget.querySelector('input')
              : null
          input?.focus()
        }}
      >
        <div className="flex-none border-b border-line-soft p-2">
          <SearchInput
            aria-label={`Filter ${ariaLabel.toLowerCase()} options`}
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={(next) => {
              setQuery(next)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={activeId}
            status={`${String(matches.length)} of ${String(options.length)}`}
            clearable
            iconSize={16}
            className="h-8"
          />
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="max-h-80 min-h-0 flex-1 overflow-auto p-1"
        >
          {matches.length === 0 && (
            <p className="m-0 px-3 py-6 text-center text-12.5 text-ink-muted">
              Nothing matches “{query.trim()}”.
            </p>
          )}
          {matches.map((option, index) => {
            const isActive = option === active
            const isSelected = option.value === value
            return (
              <div
                key={option.value}
                id={optionId(index)}
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                onClick={() => choose(option)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  choose(option)
                }}
                onMouseMove={() => setActiveIndex(index)}
                className={cn(
                  'relative flex min-h-8 cursor-pointer items-center rounded-md py-1.5 pl-8 pr-2.5 text-13 text-ink-body',
                  isActive && 'bg-selected text-ink',
                  isSelected && 'text-primary',
                )}
              >
                <Icon
                  name="check"
                  size={16}
                  aria-hidden
                  className={cn(
                    'absolute left-2',
                    isSelected ? 'visible' : 'invisible',
                  )}
                />
                <span className="min-w-0 break-words">{option.label}</span>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
