import type * as React from 'react'
import { useId } from 'react'

export function SectionLabel({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="mb-0.5 mt-[18px] text-11 font-semibold uppercase leading-none tracking-[0.06em] text-ink-secondary">
      {children}
    </div>
  )
}

export interface PreferenceControlProps {
  'aria-labelledby': string
  'aria-describedby'?: string
}

export interface PreferenceRowProps {
  label: string
  description?: string
  /** Receives the ARIA props that name the control after the row label */
  children: (controlProps: PreferenceControlProps) => React.ReactNode
}

/** Label and description on the left, control on the right. */
export function PreferenceRow({
  label,
  description,
  children,
}: PreferenceRowProps): React.ReactElement {
  const id = useId()
  const labelId = `${id}-label`
  const descriptionId = description !== undefined ? `${id}-desc` : undefined
  return (
    <div className="flex items-center gap-4 border-b border-line-soft py-3">
      <div className="min-w-0 flex-1">
        <div id={labelId} className="font-medium text-ink">
          {label}
        </div>
        {description !== undefined && (
          <div id={descriptionId} className="mt-0.5 text-12 text-ink-muted">
            {description}
          </div>
        )}
      </div>
      {children({
        'aria-labelledby': labelId,
        'aria-describedby': descriptionId,
      })}
    </div>
  )
}
