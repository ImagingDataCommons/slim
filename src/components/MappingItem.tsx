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

interface MappingItemProps {
  mapping: dmv.mapping.ParameterMapping
  metadata: dmv.metadata.ParametricMap[]
  isVisible: boolean
  defaultStyle: {
    opacity: number
  }
  onVisibilityChange: ({ mappingUID, isVisible }: {
    mappingUID: string
    isVisible: boolean
  }) => void
  onStyleChange: ({ mappingUID, styleOptions }: {
    mappingUID: string
    styleOptions: {
      opacity?: number
    }
  }) => void
}

interface MappingItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
  }
}

/**
 * React component representing a Real World Value Mapping.
 */
class MappingItem extends React.Component<MappingItemProps, MappingItemState> {
  constructor (props: MappingItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    this.handleOpacityChange = this.handleOpacityChange.bind(this)
    this.state = {
      isVisible: this.props.isVisible,
      currentStyle: {
        opacity: this.props.defaultStyle.opacity
      }
    }
  }

  handleVisibilityChange (
    checked: boolean,
    event: React.MouseEvent<HTMLButtonElement>
  ): void {
    this.props.onVisibilityChange({
      mappingUID: this.props.mapping.uid,
      isVisible: checked
    })
    this.setState({ isVisible: checked })
  }

  handleOpacityChange (value: number | null): void {
    if (value != null) {
      this.props.onStyleChange({
        mappingUID: this.props.mapping.uid,
        styleOptions: {
          opacity: value
        }
      })
      this.setState(state => ({
        currentStyle: {
          opacity: value
        }
      }))
    }
  }

  render (): React.ReactNode {
    const attributes: Array<{ name: string, value: string }> = [
      {
        name: 'Description',
        value: this.props.mapping.description
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
      mapping,
      metadata,
      onVisibilityChange,
      onStyleChange,
      ...otherProps
    } = this.props
    return (
      <Menu.Item
        style={{ height: '100%', paddingLeft: '3px' }}
        key={this.props.mapping.uid}
        {...otherProps}
      >
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
            </Space>
          </div>
          <Description
            header={this.props.mapping.label}
            attributes={attributes}
            selectable
            hasLongValues
          />
        </Space>
      </Menu.Item>
    )
  }
}

export default MappingItem
