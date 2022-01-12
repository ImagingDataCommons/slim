import React from 'react'
import {
  Badge,
  Button,
  Col,
  Popover,
  Row,
  Slider,
  Space,
  Switch,
  Tooltip
} from 'antd'
import {
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  SettingOutlined
} from '@ant-design/icons';
import Description from './Description'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'

import { SpecimenPreparationStepItems } from '../data/specimens'

interface OpticalPathItemProps {
  opticalPath: dmv.opticalPath.OpticalPath
  metadata: dmv.metadata.VLWholeSlideMicroscopyImage[]
  isVisible: boolean
  defaultStyle: {
    opacity: number
    color: number[]
    limitValues: number[]
  }
  onVisibilityChange: ({ opticalPathIdentifier, isVisible }: {
    opticalPathIdentifier: string,
    isVisible: boolean
  }) => void
  onStyleChange: ({ opticalPathIdentifier, styleOptions }: {
    opticalPathIdentifier: string,
    styleOptions: {
      opacity?: number
      color?: number[]
      limitValues?: number[]
    }
  }) => void
  onRemoval: (opticalPathIdentifier: string) => void
}

interface OpticalPathItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
    color: number[]
    limitValues: number[]
  }
}

/**
 * React component representing an optical path of a
 * multi-channel acquistion with control of visualization parameters.
 */
class OpticalPathItem extends React.Component<OpticalPathItemProps, OpticalPathItemState> {

  constructor (props: OpticalPathItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    this.handleOpacityChange = this.handleOpacityChange.bind(this)
    this.handleLimitChange = this.handleLimitChange.bind(this)
    this.handleColorRChange = this.handleColorRChange.bind(this)
    this.handleColorGChange = this.handleColorGChange.bind(this)
    this.handleColorBChange = this.handleColorBChange.bind(this)
    this.handleRemoval = this.handleRemoval.bind(this)
    this.getCurrentColor = this.getCurrentColor.bind(this)
    this.state = {
      isVisible: this.props.isVisible,
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
        color: this.props.defaultStyle.color,
        limitValues: this.props.defaultStyle.limitValues,
      }
    }
  }

  handleVisibilityChange (
    checked: boolean,
    event: Event
  ): void {
    const identifier = this.props.opticalPath.identifier
    this.setState({
      isVisible: checked
    })
    this.props.onVisibilityChange({
      opticalPathIdentifier: identifier,
      isVisible: checked
    })
  }

  handleOpacityChange (
    value: number
  ): void {
    const identifier = this.props.opticalPath.identifier
    this.props.onStyleChange({
      opticalPathIdentifier: identifier,
      styleOptions: {
        opacity: value
      }
    })
  }

  handleColorRChange (
    value: number
  ): void {
    const identifier = this.props.opticalPath.identifier
    const color = [
      value,
      this.state.currentStyle.color[1],
      this.state.currentStyle.color[2]
    ]
    this.setState(state => ({
      currentStyle: {
        color: color,
        opacity: state.currentStyle.opacity,
        limitValues: state.currentStyle.limitValues,
      }
    }))
    this.props.onStyleChange({
      opticalPathIdentifier: identifier,
      styleOptions: { color: color }
    })
  }

  handleColorGChange (
    value: number
  ): void {
    const identifier = this.props.opticalPath.identifier
    const color = [
      this.state.currentStyle.color[0],
      value,
      this.state.currentStyle.color[2]
    ]
    this.setState(state => ({
      currentStyle: {
        color: color,
        opacity: state.currentStyle.opacity,
        limitValues: state.currentStyle.limitValues,
      }
    }))
    this.props.onStyleChange({
      opticalPathIdentifier: identifier,
      styleOptions: { color: color }
    })
  }

  handleColorBChange (
    value: number
  ): void {
    const identifier = this.props.opticalPath.identifier
    const color = [
      this.state.currentStyle.color[0],
      this.state.currentStyle.color[1],
      value
    ]
    this.setState(state => ({
      currentStyle: {
        color: color,
        opacity: state.currentStyle.opacity,
        limitValues: state.currentStyle.limitValues,
      }
    }))
    this.props.onStyleChange({
      opticalPathIdentifier: identifier,
      styleOptions: { color: color }
    })
  }

  getCurrentColor (): string {
    const color = this.state.currentStyle.color
    const r = color[0]
    const g = color[1]
    const b = color[2]
    return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)
  }

  handleLimitChange (
    values: number[]
  ): void {
    const identifier = this.props.opticalPath.identifier
    this.setState(state => ({
      currentStyle: {
        color: state.currentStyle.color,
        opacity: state.currentStyle.opacity,
        limitValues: values,
      }
    }))
    this.props.onStyleChange({
      opticalPathIdentifier: identifier,
      styleOptions: {
        limitValues: values
      }
    })
  }

  handleRemoval (): void {
    const identifier = this.props.opticalPath.identifier
    this.props.onRemoval(identifier)
  }

  render (): React.ReactNode {
    const identifier = this.props.opticalPath.identifier
    const attributes: Array<{ name: string, value: string }> = []

    // TID 8001 "Specimen Preparation"
    const specimen = this.props.metadata[0].SpecimenDescriptionSequence[0]
    specimen.SpecimenPreparationSequence.forEach(
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

    const maxValue = Math.pow(2, this.props.metadata[0].BitsAllocated) - 1

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
              defaultValue={this.props.defaultStyle.color[0]}
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
              defaultValue={this.props.defaultStyle.color[1]}
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
              defaultValue={this.props.defaultStyle.color[2]}
              onAfterChange={this.handleColorBChange}
            />
          </Col>

          <Col span={9}>
            Window
          </Col>
          <Col span={15}>
            <Slider
              range
              min={0}
              max={maxValue}
              step={1}
              defaultValue={[
                this.props.defaultStyle.limitValues[0],
                this.props.defaultStyle.limitValues[1]
              ]}
              onAfterChange={this.handleLimitChange}
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
              defaultValue={this.props.defaultStyle.opacity}
              onAfterChange={this.handleOpacityChange}
            />
          </Col>
        </Row>
      </div>
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
                checkedChildren={<EyeOutlined />}
                unCheckedChildren={<EyeInvisibleOutlined />}
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
              <Tooltip title='Remove Optical Path'>
                <Button
                  type='default'
                  shape='circle'
                  icon={<DeleteOutlined />}
                  onClick={this.handleRemoval}
                />
              </Tooltip>
            </Space>
          </Space>
        </div>
        <Space direction='horizontal' align='start'>
          <Badge.Ribbon
            style={{
              borderStyle: 'solid',
              borderWidth: '1px',
              borderColor: 'gray',
              visibility: this.state.isVisible ? 'visible' : 'hidden'
            }}
            color={this.getCurrentColor()}
          >
            <Description
              header={identifier}
              attributes={attributes}
              selectable
              hasLongValues
            />
          </Badge.Ribbon>
        </Space>
      </Space>
    )
  }
}

export default OpticalPathItem
