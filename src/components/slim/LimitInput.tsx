import type * as React from 'react'
import { useState } from 'react'

import { cn } from '../../lib/utils'
import { parseLimitInput } from '../../utils/limits'
import { Input } from '../ui/input'

export interface LimitInputProps {
  value: number
  /** Called on blur or Enter with the parsed value; callers clamp */
  onCommit: (value: number) => void
  integer?: boolean
  min?: number
  max?: number
  step?: number
  'aria-label': string
  className?: string
}

/**
 * Number field that keeps the typed text until it is committed, so clamping
 * against the other limit doesn't fight intermediate keystrokes.
 */
export function LimitInput({
  value,
  onCommit,
  integer = false,
  min,
  max,
  step,
  'aria-label': ariaLabel,
  className,
}: LimitInputProps): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (): void => {
    if (draft === null) return
    const parsed = parseLimitInput(draft, integer)
    setDraft(null)
    if (parsed !== undefined) onCommit(parsed)
  }

  return (
    <Input
      type="number"
      inputMode={integer ? 'numeric' : 'decimal'}
      min={min}
      max={max}
      step={step ?? (integer ? 1 : 'any')}
      aria-label={ariaLabel}
      className={cn('h-8 w-20 font-mono text-[12px]', className)}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') setDraft(null)
      }}
    />
  )
}

export default LimitInput
