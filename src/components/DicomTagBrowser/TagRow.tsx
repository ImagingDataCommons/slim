import type { JSX } from 'react'

import { cn } from '../../lib/utils'
import { Icon } from '../ui/icon'
import type { TagTreeNode } from './dicomTagUtils'

const TAG_GRID_COLUMNS = 'grid-cols-[150px_52px_minmax(0,1fr)_minmax(0,1.4fr)]'

export { TAG_GRID_COLUMNS }

/** Recursive tag row with expandable sequence items */
export interface TagRowProps {
  item: TagTreeNode
  depth: number
  expandedKeys: ReadonlySet<string>
  onToggle: (key: string) => void
}

export function TagRow({
  item,
  depth,
  expandedKeys,
  onToggle,
}: TagRowProps): JSX.Element {
  const hasChildren = item.children !== undefined && item.children.length > 0
  const isExpanded = expandedKeys.has(item.key)

  const rowClassName = cn(
    'grid min-h-control w-full items-center gap-3 border-b border-line-row px-5 text-left hover:bg-selected',
    TAG_GRID_COLUMNS,
    depth > 0 ? 'bg-subtle/60' : 'bg-panel',
  )

  return (
    <>
      <tr className={rowClassName}>
        <td
          className="flex items-center gap-0.5 font-mono text-12 text-ink-secondary"
          style={{ paddingLeft: depth * 18 }}
        >
          <span className="w-4 flex-none text-ink-muted">
            {hasChildren ? (
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-label={`${item.tag} ${item.keyword}`.trim()}
                onClick={() => onToggle(item.key)}
                className="grid place-items-center rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Icon
                  name={isExpanded ? 'expand_more' : 'chevron_right'}
                  size={16}
                />
              </button>
            ) : null}
          </span>
          {item.tag}
        </td>
        <td>
          {item.vr !== '' && (
            <span className="rounded-sm bg-chip px-[5px] py-0.5 font-mono text-11 font-medium text-chip-foreground">
              {item.vr}
            </span>
          )}
        </td>
        <td className="truncate font-medium text-ink">{item.keyword}</td>
        <td className="break-all py-1.5 font-mono text-12 text-ink-body">
          {item.value}
        </td>
      </tr>
      {hasChildren &&
        isExpanded &&
        item.children?.map((child) => (
          <TagRow
            key={child.key}
            item={child}
            depth={depth + 1}
            expandedKeys={expandedKeys}
            onToggle={onToggle}
          />
        ))}
    </>
  )
}
