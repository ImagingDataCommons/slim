import React from 'react'
import { Button, Popover, Slider, Space, Switch } from 'antd'
import { SettingOutlined } from '@ant-design/icons';
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import Description from './Description'
import * as dmv from 'dicom-microscopy-viewer'


interface ChannelItemProps {
  identifier: string,
  description: string,
  viewer: dmv.viewer.VolumeImageViewer
}

interface ChannelItemState {
  visible: boolean
}

/**
 * React component representing a DICOM Optical Path for multichannel acquistions and
 * give controls on visualization parameters
 */
class ChannelItem extends React.Component<ChannelItemProps, ChannelItemState> {
  state = {
    visible: false
  }

  constructor (props: ChannelItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
  }

  handleVisibilityChange (
    checked: boolean,
    event: Event
  ): void {
    if (checked) {
      this.props.viewer.showOpticalPath(this.props.identifier)
      this.setState(state => ({ visible: true }))
    } else {
      this.props.viewer.hideOpticalPath(this.props.identifier)
      this.setState(state => ({ visible: false }))
    }
  }

  componentDidMount (): void {
    const blendInfo = this.props.viewer.getBlendingInformation
      (this.props.identifier) as dmv.viewer.BlendingInformation
    this.setState(state => ({ visible: blendInfo.visible }))
  }

  render (): React.ReactNode {
    const attributes: Array<{ name: string, value: string }> = []
    attributes.push({
      name: '',
      value: this.props.description
    })

    const content = (
      <div style={{ width: "100%", height: "100%" }}>
        <Slider />
      </div>
    );

    return (
      <Space align='start'>
        <div style={{ paddingLeft: '14px', paddingTop: '10px' }}>
          <Space direction="vertical">
            <Switch
              size='small'
              checked={this.state.visible}
              onChange={this.handleVisibilityChange}
              checkedChildren={<FaEye />}
              unCheckedChildren={<FaEyeSlash />}
            />
            
            <Popover placement="left" content={content} title={"Blending"}>
              <Button type="primary" shape="circle" icon={<SettingOutlined />}>
              </Button>
            </Popover>
          </Space>
        </div>
        <Description
          header={'ID: ' + this.props.identifier}
          attributes={attributes}
          selectable
        />
      </Space>
    )
  }
}

export default ChannelItem
