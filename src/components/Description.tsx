import type React from 'react'

import { cn } from '../lib/utils'
import { type KeyValueItem, SlimKeyValueGrid } from './slim/SlimKeyValueGrid'

export interface Attribute {
  name: string
  value: React.ReactNode
}

export interface AttributeGroup {
  name: string
  attributes: Attribute[]
}

interface DescriptionProps {
  header?: string
  attributes: Attribute[]
  /** Label column width of the key/value grid */
  labelWidth?: 96 | 104
  methods?: React.ReactNode[]
  children?: React.ReactNode
  className?: string
}

/**
 * Key/value description. With a `header` it renders as a bordered panel card
 * (specimens, groups); without, as a bare grid.
 */
function Description({
  header,
  attributes,
  labelWidth = 104,
  methods,
  children,
  className,
}: DescriptionProps): React.ReactElement {
  const items: KeyValueItem[] = attributes.map((item) => ({
    label: item.name,
    value: item.value,
  }))

  if (header === undefined) {
    return (
      <div className={className}>
        {items.length > 0 && (
          <SlimKeyValueGrid items={items} labelWidth={labelWidth} />
        )}
        {children}
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-line px-3 py-2.5', className)}>
      <div className="mb-2 break-words font-semibold text-ink">{header}</div>
      {items.length > 0 && (
        <SlimKeyValueGrid items={items} labelWidth={labelWidth} />
      )}
      {children}
      {methods !== undefined && methods.length > 0 && (
        <div className="mt-2.5 flex justify-end gap-2">{methods}</div>
      )}
    </div>
  )
}

export default Description
