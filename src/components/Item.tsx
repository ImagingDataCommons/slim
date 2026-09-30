import type React from 'react'

import Description, { type Attribute, type AttributeGroup } from './Description'

interface ItemProps {
  uid: string
  identifier: string
  attributes: Attribute[]
  groups?: AttributeGroup[]
  children?: React.ReactNode
  type?: string
}

/**
 * Titled panel card with a key/value grid, optional nested attribute groups
 * and trailing content.
 */
function Item({
  uid,
  identifier,
  attributes,
  groups,
  children,
  type,
}: ItemProps): React.ReactElement {
  const title = type !== undefined ? `${type}: ${identifier}` : identifier
  return (
    <Description key={uid} header={title} attributes={attributes}>
      {groups?.map((group) => (
        <div
          key={group.name}
          className="mt-2.5 border-t border-line-soft pt-2.5"
        >
          <div className="mb-1.5 text-[12px] font-medium text-ink-secondary">
            {group.name}
          </div>
          <Description attributes={group.attributes} />
        </div>
      ))}
      {children}
    </Description>
  )
}

export default Item
