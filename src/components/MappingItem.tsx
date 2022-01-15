import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Button, Col, Menu, Popover, Row, Slider, Space, Switch } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

import Description from './Description'

interface MappingItemProps {
  mapping: dmv.mapping.Mapping
  metadata: dmv.metadata.ParametricMap[]
  isVisible: boolean
  defaultStyle: {
    opacity: number
    limitValues: number[]
  }
  onVisibilityChange: ({ mappingUID, isVisible }: {
    mappingUID: string
    isVisible: boolean
  }) => void
  onStyleChange: ({ mappingUID, styleOptions }: {
    mappingUID: string,
    styleOptions: {
      opacity?: number
      limitValues?: number[]
    }
  }) => void
}

interface MappingItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
    limitValues: number[]
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
    this.handleLimitChange = this.handleLimitChange.bind(this)
    this.state = {
      isVisible: this.props.isVisible,
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
        limitValues: this.props.defaultStyle.limitValues
      }
    }
  }

  handleVisibilityChange (
    checked: boolean,
    event: Event
  ): void {
    this.props.onVisibilityChange({
      mappingUID: this.props.mapping.uid,
      isVisible: checked
    })
    this.setState({ isVisible: checked })
  }

  handleOpacityChange (value: number): void {
    this.props.onStyleChange({
      mappingUID: this.props.mapping.uid,
      styleOptions: {
        opacity: value
      }
    })
    this.setState(state => ({
      currentStyle: {
        opacity: value,
        limitValues: state.currentStyle.limitValues
      }
    }))
  }

  handleLimitChange (
    values: number[]
  ): void {
    this.setState(state => ({
      currentStyle: {
        opacity: state.currentStyle.opacity,
        limitValues: values
      }
    }))
    this.props.onStyleChange({
      mappingUID: this.props.mapping.uid,
      styleOptions: {
        limitValues: values
      }
    })
  }

  render (): React.ReactNode {
    const identifier = `Mapping ${this.props.mapping.number}`
    const attributes: Array<{ name: string, value: string }> = [
      {
        name: 'Label',
        value: this.props.mapping.label
      }
    ]

    const refInstance = this.props.metadata[0]
    const isFloatPixelData = refInstance.BitsAllocated > 16
    let minValue = 0
    let maxValue = Math.pow(2, refInstance.BitsAllocated) - 1
    if (isFloatPixelData) {
      minValue = -Math.pow(2, refInstance.BitsAllocated) / 2 + 1
      maxValue = Math.pow(2, refInstance.BitsAllocated) / 2 - 1
    }

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

          <Col span={9}>
            Window
          </Col>
          <Col span={15}>
            <Slider
              range
              min={minValue}
              max={maxValue}
              step={1}
              defaultValue={[
                this.props.defaultStyle.limitValues[0],
                this.props.defaultStyle.limitValues[1]
              ]}
              onAfterChange={this.handleLimitChange}
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
          style={{ height: '100%', paddingLeft: '3px' }}
          key={this.props.mapping.uid}
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

export default MappingItem
