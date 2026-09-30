import type * as React from 'react'
import { useState } from 'react'

import { cn } from '../../lib/utils'
import { Icon } from '../ui/icon'
import { Switch } from '../ui/switch'

export interface DisplayOption {
  id: string
  label: string
  /** Short label used in the collapsed summary, e.g. "ICC" or "Interp." */
  shortLabel?: string
  description: string
  enabled: boolean
  disabled?: boolean
  onChange: (enabled: boolean) => void
}

interface DisplayOptionsPanelProps {
  options: DisplayOption[]
  /** Optional numeric field below the switches (e.g. clustering threshold) */
  additionalInput?: {
    label: string
    description: string
    value: string
    placeholder: string
    unit: string
    onChange: (value: string) => void
  }
  defaultOpen?: boolean
  className?: string
}

/** Summary shown in the collapsed header, e.g. "ICC on · Gamma off". */
export function summarizeDisplayOptions(options: DisplayOption[]): string {
  return options
    .map((option) => {
      const label = option.shortLabel ?? option.label
      if (option.disabled === true) return `${label} n/a`
      return `${label} ${option.enabled ? 'on' : 'off'}`
    })
    .join(' · ')
}

/**
 * Collapsible "Display options" block shown under optical paths,
 * segmentations and parametric maps.
 */
export function DisplayOptionsPanel({
  options,
  additionalInput,
  defaultOpen = false,
  className,
}: DisplayOptionsPanelProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div
      className={cn(
        'mt-2 overflow-hidden rounded-lg border border-line',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 bg-subtle px-2.5 py-2 text-left text-[12.5px] font-medium text-ink-body transition-colors hover:bg-app"
      >
        <Icon name="tune" size={17} className="text-ink-secondary" />
        <span className="flex-none whitespace-nowrap">Display options</span>
        <span className="min-w-0 flex-1 truncate text-right text-[11.5px] font-normal text-ink-muted">
          {summarizeDisplayOptions(options)}
        </span>
        <Icon
          name={isOpen ? 'expand_less' : 'expand_more'}
          size={18}
          className="text-ink-faint"
        />
      </button>

      {isOpen && (
        <div className="flex flex-col border-t border-line-soft bg-panel px-3">
          {options.map((option) => (
            <div
              key={option.id}
              className="flex items-center gap-3 border-b border-line-row py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'text-[12.5px] font-medium',
                    option.disabled === true ? 'text-ink-faint' : 'text-ink',
                  )}
                >
                  {option.label}
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-muted">
                  {option.description}
                </div>
              </div>
              <Switch
                aria-label={option.label}
                checked={option.enabled && option.disabled !== true}
                onCheckedChange={option.onChange}
                disabled={option.disabled}
              />
            </div>
          ))}

          {additionalInput !== undefined && (
            <div className="flex flex-col gap-1.5 pb-3 pt-2.5">
              <div className="text-[12.5px] font-medium text-ink">
                {additionalInput.label}
              </div>
              <div className="flex h-8 items-center overflow-hidden rounded-[7px] border border-line-input focus-within:border-primary">
                <input
                  inputMode="decimal"
                  value={additionalInput.value}
                  onChange={(event) =>
                    additionalInput.onChange(event.target.value)
                  }
                  placeholder={additionalInput.placeholder}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 font-mono text-[12px] text-ink outline-none placeholder:text-ink-fainter"
                />
                <span className="grid h-full place-items-center border-l border-line-input bg-subtle px-2.5 font-mono text-[11.5px] font-medium text-ink-secondary">
                  {additionalInput.unit}
                </span>
              </div>
              <div className="text-[11.5px] text-ink-muted">
                {additionalInput.description}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DisplayOptionsPanel
