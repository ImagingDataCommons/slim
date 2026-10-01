import * as React from 'react'

import { cn } from '../../lib/utils'
import { Icon } from './icon'

export interface SearchInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange'
  > {
  value: string
  onValueChange: (value: string) => void
  /** Search fields have no visible label */
  'aria-label': string
  /** Shown before the clear button while there is a query, e.g. "3 matches" */
  status?: React.ReactNode
  /** Render a clear button while there is a query */
  clearable?: boolean
  iconSize?: number
  /** Classes of the outer field (size, width) */
  className?: string
  inputClassName?: string
}

/** Text field with a leading search icon and an optional clear button. */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onValueChange,
      status,
      clearable = false,
      iconSize = 18,
      className,
      inputClassName,
      ...props
    },
    ref,
  ) => {
    const hasQuery = value !== ''
    return (
      <label
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-lg border border-line-input bg-panel px-3 transition-colors focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15',
          className,
        )}
      >
        <Icon name="search" size={iconSize} className="text-ink-muted" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className={cn(
            'min-w-0 flex-1 border-0 bg-transparent text-13 text-ink outline-hidden placeholder:text-ink-fainter [&::-webkit-search-cancel-button]:appearance-none',
            inputClassName,
          )}
          {...props}
        />
        {hasQuery && status !== undefined && (
          <span className="flex-none text-11.5 text-ink-muted">{status}</span>
        )}
        {hasQuery && clearable && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onValueChange('')}
            className="grid h-5 w-5 flex-none place-items-center rounded-sm text-ink-muted hover:bg-subtle hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Icon name="close" size={15} />
          </button>
        )}
      </label>
    )
  },
)
SearchInput.displayName = 'SearchInput'
