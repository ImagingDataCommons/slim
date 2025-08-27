import React from 'react'
// skipcq: JS-C1003
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
  Switch,
  Divider
} from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

import Description from './Description'
import { rgbToHex } from '../utils/segmentColors'

interface SegmentItemProps {
  segment: dmv.segment.Segment
  isVisible: boolean
  metadata: dmv.metadata.Segmentation[]
  defaultStyle: {
    opacity: number
    color?: number[]
  }
  onVisibilityChange: ({ segmentUID, isVisible }: {
    segmentUID: string
    isVisible: boolean
  }) => void
  onStyleChange: ({ segmentUID, styleOptions }: {
    segmentUID: string
    styleOptions: {
      opacity: number
      color?: number[]
    }
  }) => void
}

interface SegmentItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
    color: number[]
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
    this.handleColorRChange = this.handleColorRChange.bind(this)
    this.handleColorGChange = this.handleColorGChange.bind(this)
    this.handleColorBChange = this.handleColorBChange.bind(this)

            /** Initialize with default color if not provided */
        const defaultColor = this.props.defaultStyle.color ?? [255, 255, 0] // Default yellow
    this.state = {
      isVisible: this.props.isVisible,
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
        color: defaultColor
      }
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
          opacity: value,
          color: this.state.currentStyle.color
        }
      })
      this.setState({ currentStyle: { ...this.state.currentStyle, opacity: value } })
    }
  }

  handleColorRChange (value: number | null): void {
    if (value != null) {
      const newColor = [value, this.state.currentStyle.color[1], this.state.currentStyle.color[2]]
      this.props.onStyleChange({
        segmentUID: this.props.segment.uid,
        styleOptions: {
          opacity: this.state.currentStyle.opacity,
          color: newColor
        }
      })
      this.setState({ currentStyle: { ...this.state.currentStyle, color: newColor } })
    }
  }

  handleColorGChange (value: number | null): void {
    if (value != null) {
      const newColor = [this.state.currentStyle.color[0], value, this.state.currentStyle.color[2]]
      this.props.onStyleChange({
        segmentUID: this.props.segment.uid,
        styleOptions: {
          opacity: this.state.currentStyle.opacity,
          color: newColor
        }
      })
      this.setState({ currentStyle: { ...this.state.currentStyle, color: newColor } })
    }
  }

  handleColorBChange (value: number | null): void {
    if (value != null) {
      const newColor = [this.state.currentStyle.color[0], this.state.currentStyle.color[1], value]
      this.props.onStyleChange({
        segmentUID: this.props.segment.uid,
        styleOptions: {
          opacity: this.state.currentStyle.opacity,
          color: newColor
        }
      })
      this.setState({ currentStyle: { ...this.state.currentStyle, color: newColor } })
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
        <Divider plain>Color</Divider>
        <Row justify='center' align='middle' gutter={[8, 8]}>
          <Col span={5}>
            Red
          </Col>
          <Col span={14}>
            <Slider
              range={false}
              min={0}
              max={255}
              step={1}
              value={this.state.currentStyle.color[0]}
              onChange={this.handleColorRChange}
            />
          </Col>
          <Col span={5}>
            <InputNumber
              min={0}
              max={255}
              size='small'
              style={{ width: '65px' }}
              value={this.state.currentStyle.color[0]}
              onChange={this.handleColorRChange}
            />
          </Col>
        </Row>

        <Row justify='center' align='middle' gutter={[8, 8]}>
          <Col span={5}>
            Green
          </Col>
          <Col span={14}>
            <Slider
              range={false}
              min={0}
              max={255}
              step={1}
              value={this.state.currentStyle.color[1]}
              onChange={this.handleColorGChange}
            />
          </Col>
          <Col span={5}>
            <InputNumber
              min={0}
              max={255}
              size='small'
              style={{ width: '65px' }}
              value={this.state.currentStyle.color[1]}
              onChange={this.handleColorGChange}
            />
          </Col>
        </Row>

        <Row justify='center' align='middle' gutter={[8, 8]}>
          <Col span={5}>
            Blue
          </Col>
          <Col span={14}>
            <Slider
              range={false}
              min={0}
              max={255}
              step={1}
              value={this.state.currentStyle.color[2]}
              onChange={this.handleColorBChange}
            />
          </Col>
          <Col span={5}>
            <InputNumber
              min={0}
              max={255}
              size='small'
              style={{ width: '65px' }}
              value={this.state.currentStyle.color[2]}
              onChange={this.handleColorBChange}
            />
          </Col>
        </Row>
        <Divider plain />
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
          <div style={{ flex: 1 }}>
            <Description
              header={this.props.segment.label}
              attributes={attributes}
              selectable
              hasLongValues
            />
            {/* Color indicator */}
            <div
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: rgbToHex(this.state.currentStyle.color),
                border: '1px solid #d9d9d9',
                borderRadius: '2px',
                marginTop: '8px'
              }}
              title={`Segment color: ${rgbToHex(this.state.currentStyle.color)}`}
            />
          </div>
        </Space>
      </Menu.Item>
    )
  }
}

export default SegmentItem
