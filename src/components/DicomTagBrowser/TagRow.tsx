/** biome-ignore-all lint/a11y/noRedundantRoles: the table's display overrides (flex/block/grid) drop native table semantics in Safari/VoiceOver, so the roles are restated */
import type { JSX } from 'react'

import { useLayoutMode } from '../../contexts/LayoutModeContext'
import { cn } from '../../lib/utils'
import { Icon } from '../ui/icon'
import { MonoChip } from '../ui/mono-chip'
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
  const { compactChrome } = useLayoutMode()
  const hasChildren = item.children !== undefined && item.children.length > 0
  const isExpanded = expandedKeys.has(item.key)

  const rowClassName = cn(
    'grid w-full border-b border-line-row text-left hover:bg-selected',
    compactChrome
      ? 'grid-cols-1 gap-0.5 px-4 py-2.5'
      : cn('min-h-control items-center gap-3 px-5', TAG_GRID_COLUMNS),
    depth > 0 ? 'bg-subtle/60' : 'bg-panel',
  )

  return (
    <>
      <tr role="row" className={rowClassName}>
        <td
          role="cell"
          className="flex items-center gap-0.5 font-mono text-12 text-ink-secondary"
          style={{ paddingLeft: depth * (compactChrome ? 12 : 18) }}
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
        <td role="cell">
          {item.vr !== '' && <MonoChip size="sm">{item.vr}</MonoChip>}
        </td>
        <td role="cell" className="truncate font-medium text-ink">
          {item.keyword}
        </td>
        <td
          role="cell"
          className="break-all py-1.5 font-mono text-12 text-ink-body"
        >
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
