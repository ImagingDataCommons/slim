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
} from '@ant-design/icons'
import Description from './Description'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'

import { SpecimenPreparationStepItems } from '../data/specimens'
import NotificationMiddleware, {
  NotificationMiddlewareContext
} from '../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../utils/CustomError'

interface OpticalPathItemProps {
  opticalPath: dmv.opticalPath.OpticalPath
  metadata: dmv.metadata.VLWholeSlideMicroscopyImage[]
  isVisible: boolean
  isRemovable: boolean
  defaultStyle: {
    opacity: number
    color?: number[]
    paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
    limitValues?: number[]
  }
  onVisibilityChange: ({ opticalPathIdentifier, isVisible }: {
    opticalPathIdentifier: string
    isVisible: boolean
  }) => void
  onStyleChange: ({ opticalPathIdentifier, styleOptions }: {
    opticalPathIdentifier: string
    styleOptions: {
      opacity?: number
      color?: number[]
      paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
      limitValues?: number[]
    }
  }) => void
  onRemoval: (opticalPathIdentifier: string) => void
}

interface OpticalPathItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
    color?: number[]
    paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
    limitValues?: number[]
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
    this.handleLowerLimitChange = this.handleLowerLimitChange.bind(this)
    this.handleUpperLimitChange = this.handleUpperLimitChange.bind(this)
    this.handleColorRChange = this.handleColorRChange.bind(this)
    this.handleColorGChange = this.handleColorGChange.bind(this)
    this.handleColorBChange = this.handleColorBChange.bind(this)
    this.handleRemoval = this.handleRemoval.bind(this)
    this.getCurrentColors = this.getCurrentColors.bind(this)
    this.state = {
      isVisible: this.props.isVisible,
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
        color: this.props.defaultStyle.color,
        paletteColorLookupTable: this.props.defaultStyle.paletteColorLookupTable,
        limitValues: this.props.defaultStyle.limitValues
      }
    }
  }

  componentDidUpdate (
    previousProps: OpticalPathItemProps,
    previousState: OpticalPathItemState
  ): void {
    if (this.props.defaultStyle !== previousProps.defaultStyle) {
      this.setState({
        currentStyle: this.props.defaultStyle
      })
    }
  }

  handleVisibilityChange (
    checked: boolean,
    event: React.MouseEvent<HTMLButtonElement>
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
    value: number | null
  ): void {
    if (value != null) {
      const identifier = this.props.opticalPath.identifier
      this.props.onStyleChange({
        opticalPathIdentifier: identifier,
        styleOptions: { opacity: value }
      })
      this.setState(state => ({
        currentStyle: {
          color: state.currentStyle.color,
          paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
          opacity: value,
          limitValues: state.currentStyle.limitValues
        }
      }))
    }
  }

  handleColorRChange (
    value: number | number[] | null
  ): void {
    const identifier = this.props.opticalPath.identifier
    if (value != null && this.state.currentStyle.color !== undefined) {
      const color = [
        Array.isArray(value) ? value[0] : value,
        this.state.currentStyle.color[1],
        this.state.currentStyle.color[2]
      ]
      this.setState(state => ({
        currentStyle: {
          color: color,
          paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
          opacity: state.currentStyle.opacity,
          limitValues: state.currentStyle.limitValues
        }
      }))
      this.props.onStyleChange({
        opticalPathIdentifier: identifier,
        styleOptions: { color: color }
      })
    }
  }

  handleColorGChange (
    value: number | number[] | null
  ): void {
    const identifier = this.props.opticalPath.identifier
    if (value != null && this.state.currentStyle.color !== undefined) {
      const color = [
        this.state.currentStyle.color[0],
        Array.isArray(value) ? value[0] : value,
        this.state.currentStyle.color[2]
      ]
      this.setState(state => ({
        currentStyle: {
          color: color,
          paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
          opacity: state.currentStyle.opacity,
          limitValues: state.currentStyle.limitValues
        }
      }))
      this.props.onStyleChange({
        opticalPathIdentifier: identifier,
        styleOptions: { color: color }
      })
    }
  }

  handleColorBChange (
    value: number | number[] | null
  ): void {
    const identifier = this.props.opticalPath.identifier
    if (value != null && this.state.currentStyle.color !== undefined) {
      const color = [
        this.state.currentStyle.color[0],
        this.state.currentStyle.color[1],
        Array.isArray(value) ? value[0] : value
      ]
      this.setState(state => ({
        currentStyle: {
          color: color,
          paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
          opacity: state.currentStyle.opacity,
          limitValues: state.currentStyle.limitValues
        }
      }))
      this.props.onStyleChange({
        opticalPathIdentifier: identifier,
        styleOptions: { color: color }
      })
    }
  }

  getCurrentColors (): string[] {
    const rgb2hex = (values: number[]): string => {
      const r = values[0]
      const g = values[1]
      const b = values[2]
      return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)
    }

    if (this.props.defaultStyle.paletteColorLookupTable != null) {
      const colormap = this.props.defaultStyle.paletteColorLookupTable.data
      return colormap.map(values => rgb2hex(values))
    } else if (this.state.currentStyle.color != null) {
      return [
        '#000000',
        rgb2hex(this.state.currentStyle.color)
      ]
    } else {
      return ['white', 'white']
    }
  }

  handleLowerLimitChange (
    value: number | null
  ): void {
    const identifier = this.props.opticalPath.identifier
    if (value != null && this.state.currentStyle.limitValues !== undefined) {
      this.setState(state => {
        if (state.currentStyle.limitValues !== undefined) {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
              opacity: state.currentStyle.opacity,
              limitValues: [value, state.currentStyle.limitValues[1]]
            }
          }
        } else {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
              opacity: state.currentStyle.opacity,
              limitValues: state.currentStyle.limitValues
            }
          }
        }
      })
      this.props.onStyleChange({
        opticalPathIdentifier: identifier,
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
    const identifier = this.props.opticalPath.identifier
    if (value != null && this.state.currentStyle.limitValues !== undefined) {
      this.setState(state => {
        if (state.currentStyle.limitValues !== undefined) {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
              opacity: state.currentStyle.opacity,
              limitValues: [state.currentStyle.limitValues[0], value]
            }
          }
        } else {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
              opacity: state.currentStyle.opacity,
              limitValues: state.currentStyle.limitValues
            }
          }
        }
      })
      this.props.onStyleChange({
        opticalPathIdentifier: identifier,
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
    const identifier = this.props.opticalPath.identifier
    this.setState(state => ({
      currentStyle: {
        color: state.currentStyle.color,
        paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
        opacity: state.currentStyle.opacity,
        limitValues: values
      }
    }))
    this.props.onStyleChange({
      opticalPathIdentifier: identifier,
      styleOptions: { limitValues: values }
    })
  }

  handleRemoval (): void {
    const identifier = this.props.opticalPath.identifier
    this.props.onRemoval(identifier)
  }

  render (): React.ReactNode {
    const identifier = this.props.opticalPath.identifier
    const description = this.props.opticalPath.description
    const attributes: Array<{ name: string, value: string }> = []
    if (this.props.opticalPath.illuminationWaveLength !== undefined) {
      attributes.push(
        {
          name: 'Illumination wavelength',
          value: `${this.props.opticalPath.illuminationWaveLength} nm`
        }
      )
    }
    if (this.props.opticalPath.illuminationColor !== undefined) {
      attributes.push(
        {
          name: 'Illumination color',
          value: this.props.opticalPath.illuminationColor.CodeMeaning
        }
      )
    }

    // TID 8001 "Specimen Preparation"
    const specimenDescriptions: dmv.metadata.SpecimenDescription[] = (
      this.props.metadata[0].SpecimenDescriptionSequence ?? []
    )
    try {
      specimenDescriptions.forEach(description => {
        const specimenPreparationSteps: dmv.metadata.SpecimenPreparation[] =
          description.SpecimenPreparationSequence ?? []
        specimenPreparationSteps.forEach(
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
                      name: 'Tissue stain',
                      value: value.CodeMeaning
                    })
                  }
                }
              } else if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.TEXT) {
                item = item as dcmjs.sr.valueTypes.TextContentItem
                if (!name.equals(SpecimenPreparationStepItems.PROCESSING_TYPE)) {
                  if (name.equals(SpecimenPreparationStepItems.STAIN)) {
                    attributes.push({
                      name: 'Tissue stain',
                      value: item.TextValue
                    })
                  }
                }
              }
            })
          }
        )
      })
    } catch (error: any) {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.DCMJS,
        new CustomError(
          errorTypes.ENCODINGANDDECODING,
          error.message
        )
      )
    }

    const maxValue = Math.pow(2, this.props.metadata[0].BitsAllocated) - 1

    const title = (
      description != null ? `${identifier}: ${description}` : identifier
    )
    let settings
    let item
    if (this.props.opticalPath.isMonochromatic) {
      // monochrome images that can be pseudo-colored
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
          </>
        )
      } else {
        colorSettings = (
          <>
            <Divider plain>
              Color
            </Divider>
            Custom pseudo-coloring is disabled because pixels are colorized via
            a provided palette color lookup table.
          </>
        )
      }

      let windowSettings
      if (this.state.currentStyle.limitValues != null) {
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
                  min={0}
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
      settings = (
        <div>
          {windowSettings}
          {colorSettings}
          <Divider plain />
          <Row justify='center' align='middle' gutter={[8, 8]}>
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
      const colors = this.getCurrentColors()
      item = (
        <Badge
          offset={[-20, 20]}
          count={' '}
          style={{
            borderStyle: 'solid',
            borderWidth: '1px',
            borderColor: 'gray',
            visibility: this.state.isVisible ? 'visible' : 'hidden',
            backgroundImage: `linear-gradient(to right, ${colors.toString()})`
          }}
        >
          <Description
            header={title}
            attributes={attributes}
            selectable
            hasLongValues
          />
        </Badge>
      )
    } else {
      // color images
      settings = (
        <div>
          <Row justify='center' align='middle' gutter={[8, 8]}>
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
                style={{ width: '60px' }}
                value={this.state.currentStyle.opacity}
                onChange={this.handleOpacityChange}
              />
            </Col>
          </Row>
        </div>
      )
      item = (
        <Description
          header={title}
          attributes={attributes}
          selectable
          hasLongValues
        />
      )
    }

    const buttons = []
    if (this.props.isRemovable) {
      buttons.push(
        <Tooltip title='Remove Optical Path'>
          <Button
            type='default'
            shape='circle'
            icon={<DeleteOutlined />}
            onClick={this.handleRemoval}
          />
        </Tooltip>
      )
    }

    const {
      defaultStyle,
      isRemovable,
      isVisible,
      metadata,
      onVisibilityChange,
      onStyleChange,
      onRemoval,
      opticalPath,
      ...otherProps
    } = this.props
    return (
      <Menu.Item
        style={{ height: '100%', paddingLeft: '3px' }}
        key={this.props.opticalPath.identifier}
        {...otherProps}
      >
        <Space align='start'>
          <div style={{ paddingLeft: '14px' }}>
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
                overlayStyle={{ width: '350px' }}
                title='Display Settings'
              >
                <Button
                  type='primary'
                  shape='circle'
                  icon={<SettingOutlined />}
                />
              </Popover>
              {buttons}
            </Space>
          </div>
          {item}
        </Space>
      </Menu.Item>
    )
  }
}

export default OpticalPathItem
