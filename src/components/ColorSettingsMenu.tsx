import React from 'react'
import ColorSlider from './ColorSlider'
import OpacitySlider from './OpacitySlider'
import type { StyleOptions } from './SlideViewer/types'
import { Switch } from './ui/switch'

interface ColorSettingsMenuProps {
  annotationGroupsUIDs: string[]
  defaultStyle: {
    opacity: number
    color: number[]
    contourOnly: boolean
  }
  onStyleChange: (arg: { uid: string; styleOptions: StyleOptions }) => void
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
          opacity:
            this.state.currentStyle.opacity ?? this.props.defaultStyle.opacity,
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
            color:
              this.state.currentStyle.color ?? this.props.defaultStyle.color,
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
          color: this.state.currentStyle.color ?? this.props.defaultStyle.color,
          opacity:
            this.state.currentStyle.opacity ?? this.props.defaultStyle.opacity,
          contourOnly: value,
        },
      })
    })
  }

  handleShowOutlineOnlyCheckbox = (checked: boolean): void => {
    this.handleShowOutlineOnly(checked)
  }

  getCurrentColor = (): string => {
    const rgb2hex = (values: number[]): string => {
      const r = values[0]
      const g = values[1]
      const b = values[2]
      return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
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
    let colorSettings: React.ReactNode
    if (
      this.state.currentStyle.color !== null &&
      this.state.currentStyle.color !== undefined
    ) {
      colorSettings = (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-ink-muted">Color</span>
          <ColorSlider
            color={this.state.currentStyle.color}
            onChange={this.handleColorChange}
          />
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4">
        {colorSettings}
        <OpacitySlider
          opacity={this.state.currentStyle.opacity}
          onChange={this.handleOpacityChange}
        />
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-ink">
            Outline only
          </span>
          <Switch
            size="sm"
            checked={this.state.currentStyle.contourOnly}
            onCheckedChange={this.handleShowOutlineOnlyCheckbox}
            aria-label="Show outline only"
          />
        </div>
      </div>
    )
  }
}

export default ColorSettingsMenu
