import React from 'react'
import { Badge, Button, Col, Popover, Row, Slider, Space, Switch } from 'antd'
import { CloseCircleOutlined, SettingOutlined } from '@ant-design/icons'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import Description from './Description'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'

interface SampleItemProps {
  opticalPathDescription: dmv.metadata.OpticalPathDescription
  specimenDescription: dmv.metadata.SpecimenDescription
  viewer: dmv.viewer.VolumeImageViewer
  itemRemoveHandler: (opticalPathIdentifier: string) => void
}

interface SampleItemState {
  visible: boolean
  opacity: number
  thresholdValues: number[]
  color: number[]
  limitValues: number[]
}

/**
 * React component representing a DICOM Optical Path for multichannel acquistions and
 * give controls on visualization parameters
 */
class SampleItem extends React.Component<SampleItemProps, SampleItemState> {
  state = {
    visible: false,
    opacity: 1,
    thresholdValues: [0, 255],
    color: [255, 255, 255],
    limitValues: [0, 255]
  }

  constructor (props: SampleItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    this.handleOpacityChange = this.handleOpacityChange.bind(this)
    this.handleClippingChange = this.handleClippingChange.bind(this)
    this.handleLimitChange = this.handleLimitChange.bind(this)
    this.handleColorRChange = this.handleColorRChange.bind(this)
    this.handleColorGChange = this.handleColorGChange.bind(this)
    this.handleColorBChange = this.handleColorBChange.bind(this)
    this.handleRemoveSample = this.handleRemoveSample.bind(this)
  }

  handleVisibilityChange (
    checked: boolean,
    event: Event
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    if (checked) {
      this.props.viewer.showOpticalPath(identifier)
      this.setState(state => ({ visible: true }))
    } else {
      this.props.viewer.hideOpticalPath(identifier)
      this.setState(state => ({ visible: false }))
    }
  }

  handleOpacityChange (
    value: number
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const blendingInformation = {
      opacity: value,
      opticalPathIdentifier: identifier
    }
    this.setState(state => ({ opacity: value }))
    this.props.viewer.setBlendingInformation(blendingInformation)
  }

  handleColorRChange (
    value: number
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const blendInfo =
      this.props.viewer.getBlendingInformation(identifier) as dmv.channel.BlendingInformation
    const color = [...blendInfo.color]
    color[0] = value / 255
    const blendingInformation = {
      color: color,
      opticalPathIdentifier: identifier
    }
    this.setState(state => ({ color: color }))
    this.props.viewer.setBlendingInformation(blendingInformation)
  }

  handleColorGChange (
    value: number
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const blendInfo =
      this.props.viewer.getBlendingInformation(identifier) as dmv.channel.BlendingInformation
    const color = [...blendInfo.color]
    color[1] = value / 255
    const blendingInformation = {
      color: color,
      opticalPathIdentifier: identifier
    }
    this.setState(state => ({ color: color }))
    this.props.viewer.setBlendingInformation(blendingInformation)
  }

  handleColorBChange (
    value: number
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const blendInfo =
      this.props.viewer.getBlendingInformation(identifier) as dmv.channel.BlendingInformation
    const color = [...blendInfo.color]
    color[2] = value / 255
    const blendingInformation = {
      color: color,
      opticalPathIdentifier: identifier
    }
    this.setState(state => ({ color: color }))
    this.props.viewer.setBlendingInformation(blendingInformation)
  }

  handleClippingChange (
    values: number[]
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const blendingInformation = {
      thresholdValues: values,
      opticalPathIdentifier: identifier
    }
    this.setState(state => ({ thresholdValues: values }))
    this.props.viewer.setBlendingInformation(blendingInformation)
  }

  handleLimitChange (
    values: number[]
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const blendingInformation = {
      limitValues: values,
      opticalPathIdentifier: identifier
    }
    this.setState(state => ({ limitValues: values }))
    this.props.viewer.setBlendingInformation(blendingInformation)
  }

  handleRemoveSample (): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    this.props.itemRemoveHandler(identifier)
  }

  componentDidMount (): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const blendInfo =
      this.props.viewer.getBlendingInformation(identifier) as dmv.channel.BlendingInformation
    this.setState(state => ({ visible: blendInfo.visible }))
  }

  render (): React.ReactNode {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const attributes: Array<{ name: string, value: string }> = []

    const specimenDescription = this.props.specimenDescription
    if ('SpecimenShortDescription' in specimenDescription) {
      const description = specimenDescription.SpecimenShortDescription
      if (description !== null && description !== undefined) {
        attributes.push({
          name: 'Specimen Description',
          value: description
        })
      }
    }

    function doesCodeMatch (
      code: dcmjs.sr.coding.CodedConcept,
      scheme: string,
      value: string
    ): boolean {
      if (code.CodingSchemeDesignator === scheme && code.CodeValue === value) {
        return true
      }
      return false
    }

    // TID 8001 "Specimen Preparation"
    this.props.specimenDescription.SpecimenPreparationSequence.forEach(
      (step: dmv.metadata.SpecimenPreparation, index: number): void => {
        step.SpecimenPreparationStepContentItemSequence.forEach((
          item: (
            dcmjs.sr.valueTypes.CodeContentItem |
            dcmjs.sr.valueTypes.TextContentItem |
            dcmjs.sr.valueTypes.UIDRefContentItem |
            dcmjs.sr.valueTypes.PNameContentItem |
            dcmjs.sr.valueTypes.DateTimeContentItem
          ),
          index: number
        ) => {
          const name = item.ConceptNameCodeSequence[0]
          if (item.ValueType === 'CODE') {
            item = item as dcmjs.sr.valueTypes.CodeContentItem
            const value = item.ConceptCodeSequence[0]
            if (doesCodeMatch(name, 'DCM', '111701')) {
              // Processing Type
              const processingType = value.CodeMeaning
              console.debug(
                `parse specimen preparation step "${processingType}"`
              )
            } else {
              if (doesCodeMatch(name, 'SCT', '424361007')) {
                attributes.push({
                  name: 'Stain',
                  value: value.CodeMeaning
                })
              }
            }
          } else if (item.ValueType === 'TEXT') {
            item = item as dcmjs.sr.valueTypes.TextContentItem
            if (doesCodeMatch(name, 'SCT', '424361007')) {
              attributes.push({
                name: 'Stain',
                value: item.TextValue
              })
            }
          } else {
            console.debug(`specimen preparation step #${index} not rendered`)
          }
        })
      }
    )

    const blendInfo =
      this.props.viewer.getBlendingInformation(identifier) as dmv.channel.BlendingInformation

    const content = (
      <div>
        <Row justify='center' align='middle'>
          <Col span={6}>
            <Button type='primary' shape='round'>
              R
            </Button>
          </Col>
          <Col span={18}>
            <Slider
              min={0}
              max={255}
              step={1}
              defaultValue={blendInfo.color[0] * 255}
              onAfterChange={this.handleColorRChange}
            />
          </Col>

          <Col span={6}>
            <Button type='primary' shape='round'>
              G
            </Button>
          </Col>
          <Col span={18}>
            <Slider
              min={0}
              max={255}
              step={1}
              defaultValue={blendInfo.color[1] * 255}
              onAfterChange={this.handleColorGChange}
            />
          </Col>

          <Col span={6}>
            <Button type='primary' shape='round'>
              B
            </Button>
          </Col>
          <Col span={18}>
            <Slider
              min={0}
              max={255}
              step={1}
              defaultValue={blendInfo.color[2] * 255}
              onAfterChange={this.handleColorBChange}
            />
          </Col>

          <Col span={6}>
            <Button type='primary' shape='round'>
              Min/Max
            </Button>
          </Col>
          <Col span={18}>
            <Slider
              range
              min={0}
              max={255}
              step={1}
              defaultValue={[blendInfo.limitValues[0], blendInfo.limitValues[1]]}
              onAfterChange={this.handleLimitChange}
            />
          </Col>

          <Col span={6}>
            <Button type='primary' shape='round'>
              Clipping
            </Button>
          </Col>
          <Col span={18}>
            <Slider
              range
              min={0}
              max={255}
              step={1}
              defaultValue={[blendInfo.thresholdValues[0], blendInfo.thresholdValues[1]]}
              onAfterChange={this.handleClippingChange}
            />
          </Col>

          <Col span={6}>
            <Button type='primary' shape='round'>
              Opacity
            </Button>
          </Col>
          <Col span={18}>
            <Slider
              min={0.01}
              max={1}
              step={0.01}
              defaultValue={blendInfo.opacity}
              onAfterChange={this.handleOpacityChange}
            />
          </Col>
        </Row>
      </div>
    )

    const removeSampleButton = (
      <CloseCircleOutlined
          style={{ color: '#FF0000' }}
          onClick={this.handleRemoveSample}
      />
    )

    return (
      <Space align='start'>
        <div style={{ paddingLeft: '14px', paddingTop: '10px' }}>
          <Space direction='vertical' align='end' size={100}>
            <Space direction='vertical' align='end'>
              <Switch
                size='small'
                checked={this.state.visible}
                onChange={this.handleVisibilityChange}
                checkedChildren={<FaEye />}
                unCheckedChildren={<FaEyeSlash />}
              />
              <Popover placement='left' content={content} title='Blending Parameters'>
                <Button type='primary' shape='circle' icon={<SettingOutlined />} />
              </Popover>
            </Space>
          </Space>
        </div>
        <Space direction='horizontal' align='start'>
          <Badge count={removeSampleButton} offset={[-15, 17]} title='Remove sample'>
            <Description
              header={'ID: ' + identifier}
              attributes={attributes}
              selectable
              hasLongValues
            />
          </Badge>
        </Space>
      </Space>
    )
  }
}

export default SampleItem
