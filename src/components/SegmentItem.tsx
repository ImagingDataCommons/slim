import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import {
  Button,
  Col,
  InputNumber,
  Menu,
  Popover,
  Row,
  Slider,
  Space,
  Switch
} from 'antd'
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
    segmentUID: string
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
    event: React.MouseEvent<HTMLButtonElement>
  ): void {
    this.props.onVisibilityChange({
      segmentUID: this.props.segment.uid,
      isVisible: checked
    })
    this.setState({ isVisible: checked })
  }

  handleOpacityChange (value: number | null): void {
    if (value != null) {
      this.props.onStyleChange({
        segmentUID: this.props.segment.uid,
        styleOptions: {
          opacity: value
        }
      })
      this.setState({ currentStyle: { opacity: value } })
    }
  }

  render (): React.ReactNode {
    const attributes: Array<{ name: string, value: string }> = [
      {
        name: 'Property Type',
        value: this.props.segment.propertyType.CodeMeaning
      },
      {
        name: 'Property Category',
        value: this.props.segment.propertyCategory.CodeMeaning
      },
      {
        name: 'Algorithm Name',
        value: this.props.segment.algorithmName
      }
    ]

    const settings = (
      <div>
        <Row justify='center' align='middle'>
          <Col span={6}>
            Opacity
          </Col>
          <Col span={12}>
            <Slider
              range={false}
              min={0}
              max={1}
              step={0.01}
              value={this.state.currentStyle.opacity}
              onChange={this.handleOpacityChange}
            />
          </Col>
          <Col span={6}>
            <InputNumber
              min={0}
              max={1}
              size='small'
              step={0.1}
              style={{ width: '65px' }}
              value={this.state.currentStyle.opacity}
              onChange={this.handleOpacityChange}
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
      defaultStyle,
      isVisible,
      segment,
      metadata,
      onVisibilityChange,
      onStyleChange,
      ...otherProps
    } = this.props
    return (
      <Menu.Item
        style={{ height: '100%', paddingLeft: '3px' }}
        key={this.props.segment.uid}
        {...otherProps}
      >
        <Space align='start'>
          <div style={{ paddingLeft: '14px' }}>
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
                overlayStyle={{ width: '350px' }}
                title='Display Settings'
              >
                <Button
                  type='primary'
                  shape='circle'
                  icon={<SettingOutlined />}
                />
              </Popover>
            </Space>
          </div>
          <Description
            header={this.props.segment.label}
            attributes={attributes}
            selectable
            hasLongValues
          />
        </Space>
      </Menu.Item>
    )
  }
}

export default SegmentItem
