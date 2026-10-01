import type React from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import type { SeriesOption } from '../utils/groupBySeries'

export interface OptionSelectOption {
  value: string
  label: string
}

export interface OptionSelectProps {
  value: string
  options: readonly OptionSelectOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  triggerClassName?: string
  /** Rendered before `options`, e.g. a "None" entry */
  leadingOption?: OptionSelectOption
  'aria-label'?: string
}

/** Radix select over a flat list of `{ value, label }` options. */
export function OptionSelect({
  value,
  options,
  onValueChange,
  placeholder,
  triggerClassName = 'w-full',
  leadingOption,
  'aria-label': ariaLabel,
}: OptionSelectProps): React.ReactElement {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {leadingOption !== undefined && (
          <SelectItem value={leadingOption.value}>
            {leadingOption.label}
          </SelectItem>
        )}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export interface SeriesSelectProps {
  value: string
  options: readonly SeriesOption[]
  onValueChange: (value: string) => void
}

/** Series picker shown above a list when it spans several series. */
export function SeriesSelect({
  value,
  options,
  onValueChange,
}: SeriesSelectProps): React.ReactElement | null {
  /** The first option is the "all series" entry */
  if (options.length <= 2) return null
  return (
    <OptionSelect
      value={value}
      options={options}
      onValueChange={onValueChange}
      placeholder="Select a series"
      triggerClassName="mb-2 w-full"
      aria-label="Series"
    />
  )
}
