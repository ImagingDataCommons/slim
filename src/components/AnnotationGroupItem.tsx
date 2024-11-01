import React from 'react'
import {
  Badge,
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
    color: number[]
  }
  onVisibilityChange: ({ annotationGroupUID, isVisible }: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onStyleChange: ({ uid, styleOptions }: {
    uid: string
    styleOptions: {
      opacity?: number
      color?: number[]
      limitValues?: number[]
      measurement?: dcmjs.sr.coding.CodedConcept
    }
  }) => void
}

interface AnnotationGroupItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
    color?: number[]
    limitValues?: number[]
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
    this.handleColorRChange = this.handleColorRChange.bind(this)
    this.handleColorGChange = this.handleColorGChange.bind(this)
    this.handleColorBChange = this.handleColorBChange.bind(this)
    this.getCurrentColor = this.getCurrentColor.bind(this)
    this.state = {
      isVisible: this.props.isVisible,
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
        color: this.props.defaultStyle.color
      }
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
    this.setState({ isVisible: checked })
  }

  handleOpacityChange (value: number | null): void {
    if (value != null) {
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: {
          opacity: value
        }
      })
      this.setState({
        currentStyle: {
          opacity: value,
          color: this.state.currentStyle.color,
          limitValues: this.state.currentStyle.limitValues
        }
      })
    }
  }

  handleColorRChange (
    value: number | number[] | null
  ): void {
    if (value != null && this.state.currentStyle.color !== undefined) {
      const color = [
        Array.isArray(value) ? value[0] : value,
        this.state.currentStyle.color[1],
        this.state.currentStyle.color[2]
      ]
      this.setState(state => ({
        currentStyle: {
          color: color,
          opacity: state.currentStyle.opacity,
          limitValues: state.currentStyle.limitValues
        }
      }))
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: { color: color }
      })
    }
  }

  handleColorGChange (
    value: number | number[] | null
  ): void {
    if (value != null && this.state.currentStyle.color !== undefined) {
      const color = [
        this.state.currentStyle.color[0],
        Array.isArray(value) ? value[0] : value,
        this.state.currentStyle.color[2]
      ]
      this.setState(state => ({
        currentStyle: {
          color: color,
          opacity: state.currentStyle.opacity,
          limitValues: state.currentStyle.limitValues
        }
      }))
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: { color: color }
      })
    }
  }

  handleColorBChange (
    value: number | number[] | null
  ): void {
    if (value != null && this.state.currentStyle.color !== undefined) {
      const color = [
        this.state.currentStyle.color[0],
        this.state.currentStyle.color[1],
        Array.isArray(value) ? value[0] : value
      ]
      this.setState(state => ({
        currentStyle: {
          color: color,
          opacity: state.currentStyle.opacity,
          limitValues: state.currentStyle.limitValues
        }
      }))
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: { color: color }
      })
    }
  }

  getCurrentColor (): string {
    const rgb2hex = (values: number[]): string => {
      const r = values[0]
      const g = values[1]
      const b = values[2]
      return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)
    }

    if (this.state.currentStyle.color != null) {
      return rgb2hex(this.state.currentStyle.color)
    } else {
      return 'white'
    }
  }

  handleLowerLimitChange (
    value: number | null
  ): void {
    if (value != null && this.state.currentStyle.limitValues !== undefined) {
      this.setState(state => {
        if (state.currentStyle.limitValues !== undefined) {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              opacity: state.currentStyle.opacity,
              limitValues: [value, state.currentStyle.limitValues[1]]
            }
          }
        } else {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              opacity: state.currentStyle.opacity,
              limitValues: state.currentStyle.limitValues
            }
          }
        }
      })
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: {
          limitValues: [
            value,
            this.state.currentStyle.limitValues[1]
          ]
        }
      })
    }
  }

  handleUpperLimitChange (
    value: number | null
  ): void {
    if (value != null && this.state.currentStyle.limitValues !== undefined) {
      this.setState(state => {
        if (state.currentStyle.limitValues !== undefined) {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              opacity: state.currentStyle.opacity,
              limitValues: [state.currentStyle.limitValues[0], value]
            }
          }
        } else {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              opacity: state.currentStyle.opacity,
              limitValues: state.currentStyle.limitValues
            }
          }
        }
      })
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: {
          limitValues: [
            this.state.currentStyle.limitValues[0],
            value
          ]
        }
      })
    }
  }

  handleLimitChange (
    values: number[]
  ): void {
    this.setState(state => ({
      currentStyle: {
        color: state.currentStyle.color,
        opacity: state.currentStyle.opacity,
        limitValues: values
      }
    }))
    this.props.onStyleChange({
      uid: this.props.annotationGroup.uid,
      styleOptions: { limitValues: values }
    })
  }

  handleMeasurementSelection (value?: string, option?: any): void {
    if (value != null && option.children != null) {
      const codeComponents = value.split('-')
      const measurement = new dcmjs.sr.coding.CodedConcept({
        value: codeComponents[1],
        schemeDesignator: codeComponents[0],
        meaning: option.children
      })
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: { measurement }
      })
      this.setState(state => ({
        currentStyle: {
          opacity: state.currentStyle.opacity,
          measurement
        }
      }))
    } else {
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: {
          color: this.props.defaultStyle.color
        }
      })
      this.setState(state => ({
        currentStyle: {
          opacity: state.currentStyle.opacity,
          color: this.props.defaultStyle.color,
          limitValues: undefined
        }
      }))
    }
  }

  render (): React.ReactNode {
    const index = this.props.metadata.AnnotationGroupSequence.findIndex(
      item => (item.AnnotationGroupUID === this.props.annotationGroup.uid)
    )
    const item = this.props.metadata.AnnotationGroupSequence[index]
    const attributes: Array<{ name: string, value: string }> = [
      {
        name: 'Property type',
        value: this.props.annotationGroup.propertyType.CodeMeaning
      },
      {
        name: 'Property category',
        value: this.props.annotationGroup.propertyCategory.CodeMeaning
      },
      // {
      //   name: 'Algorithm Name',
      //   value: this.props.annotationGroup.algorithmName
      // },
      {
        name: 'Graphic type',
        value: item.GraphicType
      },
      {
        name: 'Annotation coordinate type',
        value: this.props.metadata.AnnotationCoordinateType
      }
    ]

    const measurementsSequence = item.MeasurementsSequence ?? []
    const measurementOptions = measurementsSequence.map((measurementItem, i) => {
      const name = measurementItem.ConceptNameCodeSequence[0]
      return (
        <Select.Option
          key={i}
          value={`${name.CodingSchemeDesignator}-${name.CodeValue}`}
          dropdownMatchSelectWidth={false}
          size='small'
          disabled={!this.props.isVisible}
        >
          {name.CodeMeaning}
        </Select.Option>
      )
    })
    measurementOptions.push(
      <Select.Option
        key='-'
        value={undefined}
        dropdownMatchSelectWidth={false}
        size='small'
        disabled={!this.props.isVisible}
      >
        <></>
      </Select.Option>
    )

    let colorSettings
    if (this.state.currentStyle.color != null) {
      colorSettings = (
        <>
          <Divider plain>
            Color
          </Divider>
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
        </>
      )
    }

    let windowSettings
    let explorationSettings
    if (measurementsSequence.length > 0) {
      if (this.state.currentStyle.limitValues != null) {
        // TODO: need to get default min/max values from viewer first
        const minValue = 0
        const maxValue = 1000
        windowSettings = (
          <>
            <Divider plain>
              Values of interest
            </Divider>
            <Row justify='center' align='middle' gutter={[8, 8]}>
              <Col span={6}>
                <InputNumber
                  min={0}
                  max={this.state.currentStyle.limitValues[1]}
                  size='small'
                  style={{ width: '75px' }}
                  value={this.state.currentStyle.limitValues[0]}
                  onChange={this.handleLowerLimitChange}
                />
              </Col>
              <Col span={12}>
                <Slider
                  range
                  min={minValue}
                  max={maxValue}
                  step={1}
                  value={[
                    this.state.currentStyle.limitValues[0],
                    this.state.currentStyle.limitValues[1]
                  ]}
                  onChange={this.handleLimitChange}
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={this.state.currentStyle.limitValues[0]}
                  max={maxValue}
                  size='small'
                  style={{ width: '75px' }}
                  value={this.state.currentStyle.limitValues[1]}
                  onChange={this.handleUpperLimitChange}
                />
              </Col>
            </Row>
          </>
        )
      }
      explorationSettings = (
        <>
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
        </>
      )
    }

    const settings = (
      <div>
        {colorSettings}
        {windowSettings}
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
        {explorationSettings}
      </div>
    )

    const color = this.getCurrentColor()
    const isBadgeVisible = (
      this.state.isVisible && this.state.currentStyle.measurement == null
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
          <Badge
            offset={[-20, 20]}
            count={' '}
            style={{
              borderStyle: 'solid',
              borderWidth: '1px',
              borderColor: 'gray',
              visibility: isBadgeVisible ? 'visible' : 'hidden',
              backgroundImage: `linear-gradient(to bottom, ${color}, ${color}`
            }}
          >
            <Description
              header={this.props.annotationGroup.label}
              attributes={attributes}
              selectable
              hasLongValues
            />
          </Badge>
        </Space>
      </Menu.Item>
    )
  }
}

export default AnnotationGroupItem
