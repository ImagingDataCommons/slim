import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Button, Col, Menu, Popover, Row, Slider, Space, Switch } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

import Description from './Description'

interface SegmentItemProps {
  segment: dmv.segment.Segment
  isVisible: boolean
  metadata: dmv.metadata.Segmentation[]
  defaultStyle: {
    opacity: number
  }
  onVisibilityChange: ({ segmentUID, isVisible }: {
    segmentUID: string
    isVisible: boolean
  }) => void
  onStyleChange: ({ segmentUID, styleOptions }: {
    segmentUID: string,
    styleOptions: {
      opacity: number
    }
  }) => void
}

interface SegmentItemState {
  isVisible: boolean
  currentStyle: {
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
      isVisible: this.props.isVisible,
      currentStyle: { opacity: this.props.defaultStyle.opacity }
    }
  }

  handleVisibilityChange (
    checked: boolean,
    event: Event
  ): void {
    this.props.onVisibilityChange({
      segmentUID: this.props.segment.uid,
      isVisible: checked
    })
    this.setState({ isVisible: checked })
  }

  handleOpacityChange (value: number): void {
    this.props.onStyleChange({
      segmentUID: this.props.segment.uid,
      styleOptions: {
        opacity: value
      }
    })
    this.setState({ currentStyle: { opacity: value }})
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
              defaultValue={this.state.currentStyle.opacity}
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
      onStyleChange,
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
