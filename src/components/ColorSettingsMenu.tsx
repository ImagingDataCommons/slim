import React from 'react'
import { Checkbox, Divider, Row } from 'antd'

import ColorSlider from './ColorSlider'
import OpacitySlider from './OpacitySlider'

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
  constructor(props: ColorSettingsMenuProps) {
    super(props)
    this.state = {
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
        color: this.props.defaultStyle.color,
        contourOnly: this.props.defaultStyle.contourOnly,
      },
    }
  }

  handleColorChange = (color: number[]): void => {
    this.updateCurrentStyle({ color })
    this.props.annotationGroupsUIDs.forEach((uid) => {
      this.props.onStyleChange({
        uid,
        styleOptions: {
          color,
          opacity: this.state.currentStyle.opacity,
          contourOnly: this.state.currentStyle.contourOnly,
        },
      })
    })
  }

  handleOpacityChange = (opacity: number | null): void => {
    if (opacity !== null) {
      this.props.annotationGroupsUIDs.forEach((uid) => {
        this.props.onStyleChange({
          uid,
          styleOptions: {
            color: this.state.currentStyle.color,
            opacity,
            contourOnly: this.state.currentStyle.contourOnly,
          },
        })
      })
      this.updateCurrentStyle({ opacity })
    }
  }

  handleShowOutlineOnly = (value: boolean): void => {
    this.updateCurrentStyle({ contourOnly: value })

    this.props.annotationGroupsUIDs.forEach((uid) => {
      this.props.onStyleChange({
        uid,
        styleOptions: {
          color: this.state.currentStyle.color,
          opacity: this.state.currentStyle.opacity,
          contourOnly: value,
        },
      })
    })
  }

  getCurrentColor = (): string => {
    const rgb2hex = (values: number[]): string => {
      const r = values[0]
      const g = values[1]
      const b = values[2]
      return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)
    }

    if (
      this.state.currentStyle.color !== null &&
      this.state.currentStyle.color !== undefined
    ) {
      return rgb2hex(this.state.currentStyle.color)
    } else {
      return 'white'
    }
  }

  updateCurrentStyle = ({
    color,
    opacity,
    contourOnly,
  }: {
    color?: number[]
    opacity?: number
    contourOnly?: boolean
  }): void => {
    this.setState((state) => ({
      currentStyle: {
        opacity: opacity ?? state.currentStyle.opacity,
        color: color ?? state.currentStyle.color,
        contourOnly: contourOnly ?? state.currentStyle.contourOnly,
      },
    }))
  }

  render(): React.ReactNode {
    let colorSettings
    if (
      this.state.currentStyle.color !== null &&
      this.state.currentStyle.color !== undefined
    ) {
      colorSettings = (
        <>
          <Divider plain>Color</Divider>
          <ColorSlider
            color={this.state.currentStyle.color}
            onChange={this.handleColorChange}
          />
          <Divider plain />
        </>
      )
    }

    return (
      <div>
        {colorSettings}
        <OpacitySlider
          opacity={this.state.currentStyle.opacity}
          onChange={this.handleOpacityChange}
        />
        <Row justify="start" align="middle" gutter={[8, 8]}>
          <Checkbox
            value={this.state.currentStyle.contourOnly}
            onChange={(event) =>
              this.handleShowOutlineOnly(event.target.checked)
            }
          >
            Show outline only
          </Checkbox>
        </Row>
      </div>
    )
  }
}

export default ColorSettingsMenu
