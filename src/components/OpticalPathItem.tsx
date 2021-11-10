import React from 'react'
import { Badge, Button, Col, Popover, Row, Slider, Space, Switch } from 'antd'
import { CloseCircleOutlined, SettingOutlined } from '@ant-design/icons'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import Description from './Description'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'

import { SpecimenPreparationStepItems } from '../data/specimens'

interface OpticalPathItemProps {
  opticalPathDescription: dmv.metadata.OpticalPathDescription
  specimenDescription: dmv.metadata.SpecimenDescription
  viewer: dmv.viewer.VolumeImageViewer
  onRemoval: (opticalPathIdentifier: string) => void
}

interface OpticalPathItemState {
  isVisible: boolean
  opacity: number
  thresholdValues: number[]
  color: number[]
  limitValues: number[]
}

/**
 * React component representing an optical path of a
 * multi-channel acquistion with control of visualization parameters.
 */
class OpticalPathItem extends React.Component<OpticalPathItemProps, OpticalPathItemState> {
  state = {
    isVisible: false,
    opacity: 1,
    thresholdValues: [0, 255],
    color: [255, 255, 255],
    limitValues: [0, 255]
  }

  constructor (props: OpticalPathItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    this.handleOpacityChange = this.handleOpacityChange.bind(this)
    this.handleClippingChange = this.handleClippingChange.bind(this)
    this.handleLimitChange = this.handleLimitChange.bind(this)
    this.handleColorRChange = this.handleColorRChange.bind(this)
    this.handleColorGChange = this.handleColorGChange.bind(this)
    this.handleColorBChange = this.handleColorBChange.bind(this)
    this.handleRemoval = this.handleRemoval.bind(this)
  }

  handleVisibilityChange (
    checked: boolean,
    event: Event
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    if (checked) {
      this.props.viewer.showOpticalPath(identifier)
      this.setState({ isVisible: true })
    } else {
      this.props.viewer.hideOpticalPath(identifier)
      this.setState({ isVisible: false })
    }
  }

  handleOpacityChange (
    value: number
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const styleOptions = {
      opacity: value,
    }
    this.setState({ opacity: value })
    this.props.viewer.setOpticalPathStyle(identifier, styleOptions)
  }

  handleColorRChange (
    value: number
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const styleCurrent = this.props.viewer.getOpticalPathStyle(identifier)
    const styleOptions = {
      color: styleCurrent.color
    }
    styleOptions.color[0] = value
    this.setState({ color: styleOptions.color })
    this.props.viewer.setOpticalPathStyle(identifier, styleOptions)
  }

  handleColorGChange (
    value: number
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const styleCurrent = this.props.viewer.getOpticalPathStyle(identifier)
    const styleOptions = {
      color: styleCurrent.color
    }
    styleOptions.color[1] = value
    this.setState({ color: styleOptions.color })
    this.props.viewer.setOpticalPathStyle(identifier, styleOptions)
  }

  handleColorBChange (
    value: number
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const styleCurrent = this.props.viewer.getOpticalPathStyle(identifier)
    const styleOptions = {
      color: styleCurrent.color
    }
    styleOptions.color[2] = value
    this.setState({ color: styleOptions.color })
    this.props.viewer.setOpticalPathStyle(identifier, styleOptions)
  }

  handleClippingChange (
    values: number[]
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const styleOptions = {
      thresholdValues: values
    }
    this.setState({ thresholdValues: values })
    this.props.viewer.setOpticalPathStyle(identifier, styleOptions)
  }

  handleLimitChange (
    values: number[]
  ): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const styleOptions = {
      limitValues: values,
    }
    this.setState({ limitValues: values })
    this.props.viewer.setOpticalPathStyle(identifier, styleOptions)
  }

  handleRemoval (): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    this.props.onRemoval(identifier)
  }

  componentDidMount (): void {
    const identifier = this.props.opticalPathDescription.OpticalPathIdentifier
    const isVisible = this.props.viewer.isOpticalPathVisible(identifier)
    this.setState({ isVisible: isVisible })
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
          const name = new dcmjs.sr.coding.CodedConcept({
            value: item.ConceptNameCodeSequence[0].CodeValue,
            schemeDesignator:
              item.ConceptNameCodeSequence[0].CodingSchemeDesignator,
            meaning: item.ConceptNameCodeSequence[0].CodeMeaning
          })
          if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.CODE) {
            item = item as dcmjs.sr.valueTypes.CodeContentItem
            const value = new dcmjs.sr.coding.CodedConcept({
              value: item.ConceptCodeSequence[0].CodeValue,
              schemeDesignator:
                item.ConceptCodeSequence[0].CodingSchemeDesignator,
              meaning: item.ConceptCodeSequence[0].CodeMeaning
            })
            if (!name.equals(SpecimenPreparationStepItems.PROCESSING_TYPE)) {
              if (name.equals(SpecimenPreparationStepItems.STAIN)) {
                attributes.push({
                  name: 'Stain',
                  value: value.CodeMeaning
                })
              }
            }
          } else if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.TEXT) {
            item = item as dcmjs.sr.valueTypes.TextContentItem
            if (name.equals(SpecimenPreparationStepItems.STAIN)) {
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

    const blendInfo = this.props.viewer.getOpticalPathStyle(
      identifier
    ) as dmv.channel.BlendingInformation

    const settings = (
      <div>
        <Row justify='center' align='middle'>
          <Col span={9}>
            R
          </Col>
          <Col span={15}>
            <Slider
              min={0}
              max={255}
              step={1}
              defaultValue={blendInfo.color[0] * 255}
              onAfterChange={this.handleColorRChange}
            />
          </Col>

          <Col span={9}>
            G
          </Col>
          <Col span={15}>
            <Slider
              min={0}
              max={255}
              step={1}
              defaultValue={blendInfo.color[1] * 255}
              onAfterChange={this.handleColorGChange}
            />
          </Col>

          <Col span={9}>
            B
          </Col>
          <Col span={15}>
            <Slider
              min={0}
              max={255}
              step={1}
              defaultValue={blendInfo.color[2] * 255}
              onAfterChange={this.handleColorBChange}
            />
          </Col>

          <Col span={9}>
            Windowing limit
          </Col>
          <Col span={15}>
            <Slider
              range
              min={0}
              max={255}
              step={1}
              defaultValue={[blendInfo.limitValues[0], blendInfo.limitValues[1]]}
              onAfterChange={this.handleLimitChange}
            />
          </Col>

          <Col span={9}>
            Clipping threshold
          </Col>
          <Col span={15}>
            <Slider
              range
              min={0}
              max={255}
              step={1}
              defaultValue={[blendInfo.thresholdValues[0], blendInfo.thresholdValues[1]]}
              onAfterChange={this.handleClippingChange}
            />
          </Col>

          <Col span={9}>
            Opacity
          </Col>
          <Col span={15}>
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

    const removeButton = (
      <CloseCircleOutlined
        style={{ color: '#FF0000' }}
        onClick={this.handleRemoval}
      />
    )

    return (
      <Space align='start'>
        <div style={{ paddingLeft: '14px', paddingTop: '10px' }}>
          <Space direction='vertical' align='end' size={100}>
            <Space direction='vertical' align='end'>
              <Switch
                size='small'
                checked={this.state.isVisible}
                onChange={this.handleVisibilityChange}
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
        <Space direction='horizontal' align='start'>
          <Badge
             count={removeButton}
             offset={[-15, 17]}
             title='Remove optical path'
            >
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

export default OpticalPathItem
