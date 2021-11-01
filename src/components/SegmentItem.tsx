import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Button, Col, Menu, Popover, Row, Slider, Space, Switch } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

import Description from './Description'

interface SegmentItemProps {
  segment: dmv.segment.Segment
  index: number
  isVisible: boolean
  styleOptions: {
    opacity: number
  }
  onVisibilityChange: ({ segmentUID }: {
    segmentUID: string
  }) => void
  onOpacityChange: ({ segmentUID, value }: {
    segmentUID: string,
    value: number
  }) => void
}

interface SegmentItemState {
  styleOptions: {
    opacity: number
  }
}

/**
 * React component representing a Segment.
 */
class SegmentItem extends React.Component<SegmentItemProps, SegmentItemState> {
  constructor (props: SegmentItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    this.handleOpacityChange = this.handleOpacityChange.bind(this)
    this.state = {
      styleOptions: this.props.styleOptions
    }
  }

  handleVisibilityChange (
    checked: boolean,
    event: Event
  ): void {
    this.props.onVisibilityChange({ segmentUID: this.props.segment.uid })
  }

  handleOpacityChange (value: number): void {
    this.props.onOpacityChange({
      segmentUID: this.props.segment.uid,
      value: value
    })
    this.setState({ styleOptions: { opacity: value }})
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

    const settings = (
      <div>
        <Row justify='center' align='middle'>
          <Col span={9}>
            Opacity
          </Col>
          <Col span={15}>
            <Slider
              min={0.01}
              max={1}
              step={0.01}
              defaultValue={this.state.styleOptions.opacity}
              onAfterChange={this.handleOpacityChange}
            />
          </Col>
        </Row>
      </div>
    )

    /**
     * This hack is required for Menu.Item to work properly:
     * https://github.com/react-component/menu/issues/142
     */
    const {
      isVisible,
      onVisibilityChange,
      onOpacityChange,
      styleOptions,
      ...otherProps
    } = this.props
    return (
      <Space align='start'>
        <div style={{ paddingLeft: '14px' }}>
          <Space direction='vertical' align='end' size={100}>
            <Space direction='vertical' align='end'>
              <Switch
                size='small'
                onChange={this.handleVisibilityChange}
                checked={this.props.isVisible}
                checkedChildren={<FaEye />}
                unCheckedChildren={<FaEyeSlash />}
              />
              <Popover
                 placement='left'
                 content={settings}
                 title='Display Settings'
              >
                <Button
                  type='primary'
                  shape='circle'
                  icon={<SettingOutlined />}
                />
              </Popover>
            </Space>
          </Space>
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
