import React from 'react'
import {
  Button,
  Col,
  Divider,
  InputNumber,
  Menu,
  Popover,
  Row,
  Select,
  Slider,
  Space,
  Switch
} from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'

import Description from './Description'

interface AnnotationGroupItemProps {
  annotationGroup: dmv.annotation.AnnotationGroup
  isVisible: boolean
  metadata: dmv.metadata.MicroscopyBulkSimpleAnnotations
  defaultStyle: {
    opacity: number
  }
  onVisibilityChange: ({ annotationGroupUID, isVisible }: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onStyleChange: ({ annotationGroupUID, styleOptions }: {
    annotationGroupUID: string
    styleOptions: {
      opacity?: number
      measurement?: dcmjs.sr.coding.CodedConcept
    }
  }) => void
}

interface AnnotationGroupItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
    measurement?: dcmjs.sr.coding.CodedConcept
  }
}

/**
 * React component representing an Annotation Group.
 */
class AnnotationGroupItem extends React.Component<AnnotationGroupItemProps, AnnotationGroupItemState> {
  constructor (props: AnnotationGroupItemProps) {
    super(props)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    this.handleMeasurementSelection = this.handleMeasurementSelection.bind(this)
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
      annotationGroupUID: this.props.annotationGroup.uid,
      isVisible: checked
    })
  }

  handleOpacityChange (value: number): void {
    this.props.onStyleChange({
      annotationGroupUID: this.props.annotationGroup.uid,
      styleOptions: {
        opacity: value
      }
    })
    this.setState({ currentStyle: { opacity: value } })
  }

  handleMeasurementSelection (value?: string, option?: any): void {
    if (value !== undefined) {
      const codeComponents = value.split('-')
      const measurement = new dcmjs.sr.coding.CodedConcept({
        value: codeComponents[1],
        schemeDesignator: codeComponents[0],
        meaning: option.children
      })
      this.props.onStyleChange({
        annotationGroupUID: this.props.annotationGroup.uid,
        styleOptions: { measurement }
      })
      this.setState(state => ({
        currentStyle: {
          opacity: state.currentStyle.opacity,
          measurement
        }
      }))
    } else {
      this.setState(state => ({
        currentStyle: {
          opacity: state.currentStyle.opacity
        }
      }))
    }
  }

  render (): React.ReactNode {
    const attributes: Array<{ name: string, value: string }> = [
      {
        name: 'Property type',
        value: this.props.annotationGroup.propertyType.CodeMeaning
      },
      {
        name: 'Property category',
        value: this.props.annotationGroup.propertyCategory.CodeMeaning
      },
      {
        name: 'Algorithm Name',
        value: this.props.annotationGroup.algorithmName
      }
    ]

    const index = this.props.metadata.AnnotationGroupSequence.findIndex(
      item => (item.AnnotationGroupUID === this.props.annotationGroup.uid)
    )
    const item = this.props.metadata.AnnotationGroupSequence[index]
    const measurementsSequence = item.MeasurementsSequence ?? []

    const measurementOptions = measurementsSequence.map(measurementItem => {
      const name = measurementItem.ConceptNameCodeSequence[0]
      const key = `${name.CodingSchemeDesignator}-${name.CodeValue}`
      return (
        <Select.Option
          key={key}
          value={key}
          dropdownMatchSelectWidth={false}
          size='small'
          disabled={!this.props.isVisible}
        >
          {name.CodeMeaning}
        </Select.Option>
      )
    })

    const settings = (
      <div>
        <Row justify='start' align='middle' gutter={[8, 8]}>
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
        <Divider plain>
          Exploration
        </Divider>
        <Row justify='start' align='middle' gutter={[8, 8]}>
          <Col span={8}>
            Measurement
          </Col>
          <Col span={16}>
            <Select
              style={{ minWidth: '65px', width: '90%' }}
              onSelect={this.handleMeasurementSelection}
              key='annotation-group-measurements'
              defaultValue={undefined}
            >
              {measurementOptions}
            </Select>
          </Col>
        </Row>
      </div>
    )

    const {
      annotationGroup,
      defaultStyle,
      isVisible,
      metadata,
      onVisibilityChange,
      onStyleChange,
      ...otherProps
    } = this.props
    return (
      <Menu.Item
        style={{ height: '100%', paddingLeft: '3px' }}
        key={this.props.annotationGroup.uid}
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
            header={this.props.annotationGroup.label}
            attributes={attributes}
            selectable
            hasLongValues
          />
        </Space>
      </Menu.Item>
    )
  }
}

export default AnnotationGroupItem
