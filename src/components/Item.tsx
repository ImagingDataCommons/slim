import React from 'react'
import { List } from 'antd'

import Description, { Attribute, AttributeGroup } from './Description'

interface ItemProps {
  uid: string
  identifier: string
  attributes: Attribute[]
  groups?: AttributeGroup[]
  children?: React.ReactElement[]
  type?: string
  hasLongValues?: boolean
}

/**
 * React component for a list item that consists of a header element
 * containing an identifier and a body element containing a description list
 * of attributes rendered as name-value pairs.
 */
class Item extends React.Component<ItemProps, {}> {
  render (): React.ReactNode {
    let groups = null
    if (this.props.groups !== undefined) {
      groups = this.props.groups.map((item, index: number) => (
        <Description
          key={index}
          header={item.name}
          attributes={item.attributes}
        />
      ))
    }
    let title
    if (this.props.type !== undefined) {
      title = `${this.props.type}: ${this.props.identifier}`
    } else {
      title = this.props.identifier
    }
    return (
      <List.Item key={this.props.uid}>
        <Description
          header={title}
          attributes={this.props.attributes}
          hasLongValues={this.props.hasLongValues}
        >
          {groups}
        </Description>
        {this.props.children}
      </List.Item>
    )
  }
}

export default Item
