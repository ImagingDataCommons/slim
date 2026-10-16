import type * as React from 'react'

import {
  type LabeledControlProps,
  LabeledControlRow,
} from '../../../components/slim/LabeledControlRow'

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

export type PreferenceControlProps = LabeledControlProps

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
  return (
    <LabeledControlRow label={label} description={description}>
      {children}
    </LabeledControlRow>
  )
}
