import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu, Space, Switch } from 'antd'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

import Description from './Description'

interface SegmentItemProps {
  segment: dmv.segment.Segment
  index: number
  isVisible: boolean
  onChangeVisibility: ({ segmentUID }: { segmentUID: string }) => void
}

/**
 * React component representing a Segment.
 */
class SegmentItem extends React.Component<SegmentItemProps, {}> {
  constructor (props: SegmentItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
  }

  handleVisibilityChange (
    checked: boolean,
    event: Event
  ): void {
    this.props.onChangeVisibility({ segmentUID: this.props.segment.uid })
  }

  render (): React.ReactNode {
    const identifier = `Segment ${this.props.segment.number}`
    const attributes: Array<{ name: string, value: string }> = [
      {
        name: 'Label',
        value: this.props.segment.label
      },
      {
        name: 'Algorithm Name',
        value: this.props.segment.algorithmName
      },
      {
        name: 'Property Category',
        value: this.props.segment.propertyCategory.CodeMeaning
      },
      {
        name: 'Property Type',
        value: this.props.segment.propertyType.CodeMeaning
      },
    ]
    /**
     * This hack is required for Menu.Item to work properly:
     * https://github.com/react-component/menu/issues/142
     */
    const { isVisible, onChangeVisibility, ...otherProps } = this.props
    return (
      <Space align='start'>
        <div style={{ paddingLeft: '14px' }}>
          <Switch
            size='small'
            onChange={this.handleVisibilityChange}
            checked={this.props.isVisible}
            checkedChildren={<FaEye />}
            unCheckedChildren={<FaEyeSlash />}
          />
        </div>
        <Menu.Item
          style={{ height: '100%' }}
          key={this.props.segment.uid}
          {...otherProps}
        >
          <Description
            header={identifier}
            attributes={attributes}
            selectable
            hasLongValues
          />
        </Menu.Item>
      </Space>
    )
  }
}

export default SegmentItem
