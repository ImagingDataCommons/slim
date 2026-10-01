import type * as React from 'react'
import { useId, useState } from 'react'

import { cn } from '../../lib/utils'
import type { DisplayOptionDescriptor } from '../../utils/displayOptions'
import { Icon } from '../ui/icon'
import { Switch } from '../ui/switch'

export interface DisplayOption extends DisplayOptionDescriptor {
  onChange: (enabled: boolean) => void
}

/**
 * Numeric text field below the switches (e.g. clustering threshold). The
 * value is the raw text so partial input like "0." survives; callers parse.
 */
export interface DisplayOptionsAdditionalInput {
  label: string
  description: string
  placeholder: string
  unit: string
  inputValue?: string
  onInputChange?: (value: string) => void
  /** @deprecated Use `inputValue` */
  value?: string
  /** @deprecated Use `onInputChange` */
  onChange?: (value: string) => void
}

interface DisplayOptionsPanelProps {
  options: DisplayOption[]
  additionalInput?: DisplayOptionsAdditionalInput
  defaultOpen?: boolean
  className?: string
}

/** Binds a toggle handler to plain option descriptors */
export function bindDisplayOptions(
  descriptors: DisplayOptionDescriptor[],
  onToggle: (id: string, enabled: boolean) => void,
): DisplayOption[] {
  return descriptors.map((descriptor) => ({
    ...descriptor,
    onChange: (enabled: boolean) => onToggle(descriptor.id, enabled),
  }))
}

function AdditionalInputField({
  input,
}: {
  input: DisplayOptionsAdditionalInput
}): React.ReactElement {
  const labelId = useId()
  const descriptionId = useId()
  /** Text typed while focused, so parent-side normalization can't eat "0." */
  const [draft, setDraft] = useState<string | null>(null)
  const value = input.inputValue ?? input.value ?? ''
  const handleChange = input.onInputChange ?? input.onChange

  return (
    <div className="flex flex-col gap-1.5 pb-3 pt-2.5">
      <div id={labelId} className="text-[12.5px] font-medium text-ink">
        {input.label}
      </div>
      <div className="flex h-8 items-center overflow-hidden rounded-[7px] border border-line-input focus-within:border-primary">
        <input
          inputMode="decimal"
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          value={draft ?? value}
          onChange={(event) => {
            setDraft(event.target.value)
            handleChange?.(event.target.value)
          }}
          onBlur={() => setDraft(null)}
          placeholder={input.placeholder}
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 font-mono text-[12px] text-ink outline-none placeholder:text-ink-fainter"
        />
        <span className="grid h-full place-items-center border-l border-line-input bg-subtle px-2.5 font-mono text-[11.5px] font-medium text-ink-secondary">
          {input.unit}
        </span>
      </div>
      <div id={descriptionId} className="text-[11.5px] text-ink-muted">
        {input.description}
      </div>
    </div>
  )
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
            <AdditionalInputField input={additionalInput} />
          )}
        </div>
      )}
    </div>
  )
}

export default DisplayOptionsPanel
