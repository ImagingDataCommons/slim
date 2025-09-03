import React from 'react'
// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import {
  Button,
  Menu,
  Popover,
  Space,
  Switch,
  Divider
} from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

import Description from './Description'
import ColorSlider from './ColorSlider'
import OpacitySlider from './OpacitySlider'
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

  handleVisibilityChange = (
    checked: boolean,
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    this.props.onVisibilityChange({
      segmentUID: this.props.segment.uid,
      isVisible: checked
    })
    this.setState({ isVisible: checked })
  }

  handleColorChange = (newColor: number[]): void => {
    this.setState(prevState => {
      const newStyle = { ...prevState.currentStyle, color: newColor }
      return { currentStyle: newStyle }
    }, () => {
      this.props.onStyleChange({
        segmentUID: this.props.segment.uid,
        styleOptions: {
          opacity: this.state.currentStyle.opacity,
          color: newColor
        }
      })
    })
  }

  handleOpacityChange = (opacity: number | null): void => {
    if (opacity !== null) {
      this.setState(prevState => {
        const newStyle = { ...prevState.currentStyle, opacity }
        return { currentStyle: newStyle }
      }, () => {
        this.props.onStyleChange({
          segmentUID: this.props.segment.uid,
          styleOptions: {
            opacity,
            color: this.state.currentStyle.color
          }
        })
      })
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
        <ColorSlider
          color={this.state.currentStyle.color}
          onChange={this.handleColorChange}
        />
        <Divider plain />
        <OpacitySlider
          opacity={this.state.currentStyle.opacity}
          onChange={this.handleOpacityChange}
        />
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
            <Space direction='vertical' align='center'>
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
              {/* Color indicator */}
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: rgbToHex(this.state.currentStyle.color),
                  border: '1px solid #d9d9d9',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={`Segment color: ${rgbToHex(this.state.currentStyle.color)}`}
              />
            </Space>
          </div>
          <div style={{ flex: 1 }}>
            <Description
              header={this.props.segment.label}
              attributes={attributes}
              selectable
              hasLongValues
            />
          </div>
        </Space>
      </Menu.Item>
    )
  }
}

export default SegmentItem
