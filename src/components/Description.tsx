import type React from 'react'

import { cn } from '../lib/utils'
import type { KeyValueItem } from '../utils/keyValue'
import { SlimKeyValueGrid } from './slim/SlimKeyValueGrid'

export interface DescriptionProps {
  header?: React.ReactNode
  items: KeyValueItem[]
  children?: React.ReactNode
  className?: string
}

/**
 * Key/value description. With a `header` it renders as a bordered panel card
 * (specimens, groups); without, as a bare grid.
 */
function Description({
  header,
  items,
  children,
  className,
}: DescriptionProps): React.ReactElement {
  const grid =
    items.length > 0 ? (
      <SlimKeyValueGrid items={items} labelWidth={104} />
    ) : null

  if (header === undefined) {
    return (
      <div className={className}>
        {grid}
        {children}
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-line px-3 py-2.5', className)}>
      <div className="mb-2 break-words font-semibold text-ink">{header}</div>
      {grid}
      {children}
    </div>
  )
}

export default Description
