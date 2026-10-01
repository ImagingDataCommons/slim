import * as React from 'react'

import { cn } from '../../lib/utils'
import { Icon, type IconName } from './icon'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: IconName
}

export interface SegmentedControlProps<T extends string> {
  options: Array<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  size?: 'default' | 'sm'
  /** Stretch options to fill the container width */
  fill?: boolean
  className?: string
  'aria-label'?: string
}

/** Pill-track segmented control from the Slim v2 design. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'default',
  fill = false,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>): React.ReactElement {
  const name = React.useId()
  return (
    <fieldset
      aria-label={ariaLabel}
      className={cn(
        'm-0 flex min-w-0 rounded-lg border-0 bg-app p-[3px]',
        size === 'sm' ? 'gap-0.5' : 'gap-1',
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-center justify-center gap-[5px] whitespace-nowrap rounded-md font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-primary/30',
              size === 'sm'
                ? 'px-2.5 py-[5px] text-12'
                : 'px-3 py-1.5 text-12.5',
              fill && 'flex-1',
              isActive
                ? 'bg-segmented-active text-ink shadow-segmented'
                : 'text-ink-secondary hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isActive}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon !== undefined && <Icon name={option.icon} size={16} />}
            {option.label}
          </label>
        )
      })}
    </fieldset>
  )
}
