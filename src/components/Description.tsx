import React from 'react'
import { v4 as generateUUID } from 'uuid'
import { Card, Descriptions } from 'antd'

export interface Attribute {
  name: string
  value: any
}

export interface AttributeGroup {
  name: string
  attributes: Attribute[]
}

interface DescriptionProps {
  header?: string
  icon?: any
  attributes: Attribute[]
  selectable?: boolean
  hasLongValues?: boolean
  methods?: React.ReactNode[]
  children?: React.ReactNode
}

/**
 * React component for a description consisting of a header containing a
 * header and a body containing a list of name-value pairs.
 */
class Description extends React.Component<DescriptionProps, {}> {
  render (): React.ReactNode {
    let layout: 'horizontal' | 'vertical' = 'horizontal'
    let labelLineHeight = '14px'
    const contentLineHeight = '14px'
    if (this.props.hasLongValues !== undefined && this.props.hasLongValues) {
      layout = 'vertical'
      labelLineHeight = '20px'
    }
    const items = this.props.attributes.map((item: Attribute, index: number) => {
      const uid = generateUUID()
      return (
        <Descriptions.Item
          key={uid}
          label={item.name}
          labelStyle={{
            lineHeight: labelLineHeight
          }}
          contentStyle={{
            fontWeight: 600,
            whiteSpace: 'pre-line',
            lineHeight: contentLineHeight
          }}
          span={1}
        >
          {item.value}
        </Descriptions.Item>
      )
    })
    let icon = null
    if (this.props.icon !== undefined) {
      icon = <this.props.icon />
    }
    return (
      <Card
        title={this.props.header}
        extra={icon}
        size='small'
        hoverable={this.props.selectable}
        bordered={this.props.header !== undefined}
        actions={this.props.methods}
      >
        <Descriptions
          column={1}
          size='small'
          layout={layout}
          bordered={false}
        >
          {items}
        </Descriptions>
        {this.props.children}
      </Card>
    )
  }
}

export default Description
