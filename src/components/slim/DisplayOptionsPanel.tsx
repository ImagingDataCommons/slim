import type * as React from 'react'
import { useId, useState } from 'react'

import { cn } from '../../lib/utils'
import {
  type DisplayOption,
  summarizeDisplayOptions,
} from '../../utils/displayOptionsBinding'
import { Icon } from '../ui/icon'
import { Switch } from '../ui/switch'

export type { DisplayOption } from '../../utils/displayOptionsBinding'

/**
 * Numeric text field below the switches (e.g. clustering threshold). The
 * value is the raw text so partial input like "0." survives; callers parse.
 */
export interface DisplayOptionsAdditionalInput {
  label: string
  description: string
  placeholder: string
  unit: string
  inputValue: string
  onInputChange: (value: string) => void
}

export interface DisplayOptionsPanelProps {
  options: DisplayOption[]
  additionalInput?: DisplayOptionsAdditionalInput
  className?: string
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
          value={draft ?? input.inputValue}
          onChange={(event) => {
            setDraft(event.target.value)
            input.onInputChange(event.target.value)
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

function DisplayOptionRow({
  option,
}: {
  option: DisplayOption
}): React.ReactElement {
  const labelId = useId()
  const descriptionId = useId()
  return (
    <div className="flex items-center gap-3 border-b border-line-row py-2.5">
      <div className="min-w-0 flex-1">
        <div
          id={labelId}
          className={cn(
            'text-[12.5px] font-medium',
            option.disabled === true ? 'text-ink-faint' : 'text-ink',
          )}
        >
          {option.label}
        </div>
        <div id={descriptionId} className="mt-0.5 text-[11.5px] text-ink-muted">
          {option.description}
        </div>
      </div>
      <Switch
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        checked={option.enabled && option.disabled !== true}
        onCheckedChange={option.onChange}
        disabled={option.disabled}
      />
    </div>
  )
}

/**
 * Collapsible "Display options" block shown under optical paths,
 * segmentations and parametric maps.
 */
export function DisplayOptionsPanel({
  options,
  additionalInput,
  className,
}: DisplayOptionsPanelProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)

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
            <DisplayOptionRow key={option.id} option={option} />
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
