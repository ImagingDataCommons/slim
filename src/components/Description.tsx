import React from 'react'
import { v4 as generateUUID } from 'uuid'
import { Card, Descriptions } from 'antd'
import { IconType } from 'react-icons'

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
  icon?: IconType
  attributes: Attribute[]
  selectable?: boolean
  hasLongValues?: boolean
}

class Description extends React.Component<DescriptionProps, {}> {
  render (): React.ReactNode {
    const items = this.props.attributes.map((item: Attribute, index: number) => {
      const uid = generateUUID()
      return (
        <Descriptions.Item
          key={uid}
          label={item.name}
          labelStyle={{ margin: '0 0 -10px 0' }}
          contentStyle={{ fontWeight: 600 }}
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
    let layout: 'horizontal' | 'vertical' = 'horizontal'
    if (this.props.hasLongValues !== undefined && this.props.hasLongValues) {
      layout = 'vertical'
    }
    return (
      <Card
        title={this.props.header}
        extra={icon}
        size='small'
        hoverable={this.props.selectable}
        bordered={this.props.header !== undefined}
      >
        <Descriptions column={1} size='small' layout={layout} bordered={false}>
          {items}
        </Descriptions>
        {this.props.children}
      </Card>
    )
  }
}

export default Description
