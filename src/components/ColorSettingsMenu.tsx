import React from 'react'
import { Checkbox, Col, Divider, InputNumber, Row, Slider } from 'antd'

interface ColorSettingsMenuProps {
  annotationGroupsUIDs: string[]
  defaultStyle: {
    opacity: number
    color: number[]
    contourOnly: boolean
  }
  onStyleChange: Function
}

interface ColorSettingsMenuState {
  currentStyle: {
    opacity: number
    color?: number[]
    contourOnly: boolean
  }
}

/**
 * React component representing an Annotation Group.
 */
class ColorSettingsMenu extends React.Component<
ColorSettingsMenuProps,
ColorSettingsMenuState
> {
  constructor (props: ColorSettingsMenuProps) {
    super(props)
    this.handleOpacityChange = this.handleOpacityChange.bind(this)
    this.handleColorRChange = this.handleColorRChange.bind(this)
    this.handleColorGChange = this.handleColorGChange.bind(this)
    this.handleColorBChange = this.handleColorBChange.bind(this)
    this.getCurrentColor = this.getCurrentColor.bind(this)
    this.state = {
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
        color: this.props.defaultStyle.color,
        contourOnly: this.props.defaultStyle.contourOnly
      }
    }
  }

  handleOpacityChange (value: number | null): void {
    if (value != null) {
      this.props.annotationGroupsUIDs.forEach((uid) => {
        this.props.onStyleChange({
          uid,
          styleOptions: {
            color: this.state.currentStyle.color,
            opacity: value,
            contourOnly: this.state.currentStyle.contourOnly
          }
        })
      })
      this.updateCurrentStyle({ opacity: value })
    }
  }

  handleColorRChange (value: number | number[] | null): void {
    if (value != null && this.state.currentStyle.color !== undefined) {
      const color = [
        Array.isArray(value) ? value[0] : value,
        this.state.currentStyle.color[1],
        this.state.currentStyle.color[2]
      ]
      this.updateCurrentStyle({ color })
      this.props.annotationGroupsUIDs.forEach((uid) => {
        this.props.onStyleChange({
          uid,
          styleOptions: {
            color: color,
            opacity: this.state.currentStyle.opacity,
            contourOnly: this.state.currentStyle.contourOnly
          }
        })
      })
    }
  }

  handleColorGChange (value: number | number[] | null): void {
    if (value != null && this.state.currentStyle.color !== undefined) {
      const color = [
        this.state.currentStyle.color[0],
        Array.isArray(value) ? value[0] : value,
        this.state.currentStyle.color[2]
      ]
      this.updateCurrentStyle({ color })
      this.props.annotationGroupsUIDs.forEach((uid) => {
        this.props.onStyleChange({
          uid,
          styleOptions: {
            color: color,
            opacity: this.state.currentStyle.opacity,
            contourOnly: this.state.currentStyle.contourOnly
          }
        })
      })
    }
  }

  handleColorBChange (value: number | number[] | null): void {
    if (value != null && this.state.currentStyle.color !== undefined) {
      const color = [
        this.state.currentStyle.color[0],
        this.state.currentStyle.color[1],
        Array.isArray(value) ? value[0] : value
      ]
      this.updateCurrentStyle({ color })
      this.props.annotationGroupsUIDs.forEach((uid) => {
        this.props.onStyleChange({
          uid,
          styleOptions: {
            color: color,
            opacity: this.state.currentStyle.opacity,
            contourOnly: this.state.currentStyle.contourOnly
          }
        })
      })
    }
  }

  handleShowOutlineOnly (value: boolean): void {
    this.updateCurrentStyle({ contourOnly: value })

    this.props.annotationGroupsUIDs.forEach((uid) => {
      this.props.onStyleChange({
        uid,
        styleOptions: {
          color: this.state.currentStyle.color,
          opacity: this.state.currentStyle.opacity,
          contourOnly: value
        }
      })
    })
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

  updateCurrentStyle ({
    color,
    opacity,
    contourOnly
  }: {
    color?: number[]
    opacity?: number
    contourOnly?: boolean
  }): void {
    this.setState((state) => ({
      currentStyle: {
        opacity: opacity ?? state.currentStyle.opacity,
        color: color ?? state.currentStyle.color,
        contourOnly: contourOnly ?? state.currentStyle.contourOnly
      }
    }))
  }

  render (): React.ReactNode {
    let colorSettings
    if (this.state.currentStyle.color != null) {
      colorSettings = (
        <>
          <Divider plain>Color</Divider>
          <Row justify='center' align='middle' gutter={[8, 8]}>
            <Col span={5}>Red</Col>
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
            <Col span={5}>Green</Col>
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
            <Col span={5}>Blue</Col>
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

    return (
      <div>
        {colorSettings}
        <Row justify='start' align='middle' gutter={[8, 8]}>
          <Col span={6}>Opacity</Col>
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
        <Row justify='start' align='middle' gutter={[8, 8]}>
          <Checkbox
            value={this.state.currentStyle.contourOnly}
            onChange={(event) =>
              this.handleShowOutlineOnly(event.target.checked)}
          >
            Show outline only
          </Checkbox>
        </Row>
      </div>
    )
  }
}

export default ColorSettingsMenu
