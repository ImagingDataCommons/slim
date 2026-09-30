// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'

import ColorSlider from './ColorSlider'
import OpacitySlider from './OpacitySlider'
import { Icon } from './ui/icon'
import { Input } from './ui/input'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'

/** Display name: description, else "Brightfield" for RGB, else identifier. */
export function getOpticalPathName(opticalPath: {
  identifier: string
  description?: string
  isMonochromatic: boolean
}): string {
  const description = opticalPath.description?.trim() ?? ''
  if (description !== '') return description
  if (!opticalPath.isMonochromatic) return 'Brightfield'
  return opticalPath.identifier
}

interface OpticalPathItemProps {
  opticalPath: dmv.opticalPath.OpticalPath
  metadata: dmv.metadata.VLWholeSlideMicroscopyImage[]
  isVisible: boolean
  isRemovable: boolean
  hasIccProfile?: boolean
  defaultStyle: {
    opacity: number
    color?: number[]
    paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
    limitValues?: number[]
  }
  onVisibilityChange: ({
    opticalPathIdentifier,
    isVisible,
  }: {
    opticalPathIdentifier: string
    isVisible: boolean
  }) => void
  onStyleChange: ({
    opticalPathIdentifier,
    styleOptions,
  }: {
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
class OpticalPathItem extends React.Component<
  OpticalPathItemProps,
  OpticalPathItemState
> {
  constructor(props: OpticalPathItemProps) {
    super(props)
    this.state = {
      isVisible: this.props.isVisible,
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
        color: this.props.defaultStyle.color,
        paletteColorLookupTable:
          this.props.defaultStyle.paletteColorLookupTable,
        limitValues: this.props.defaultStyle.limitValues,
      },
    }
  }

  componentDidUpdate(
    previousProps: OpticalPathItemProps,
    _previousState: OpticalPathItemState,
  ): void {
    if (this.props.defaultStyle !== previousProps.defaultStyle) {
      this.setState({
        currentStyle: this.props.defaultStyle,
      })
    }
  }

  handleVisibilityChange = (checked: boolean): void => {
    const identifier = this.props.opticalPath.identifier
    this.setState({
      isVisible: checked,
    })
    this.props.onVisibilityChange({
      opticalPathIdentifier: identifier,
      isVisible: checked,
    })
  }

  handleOpacityChange = (value: number | null): void => {
    if (value != null) {
      const identifier = this.props.opticalPath.identifier
      this.props.onStyleChange({
        opticalPathIdentifier: identifier,
        styleOptions: { opacity: value },
      })
      this.setState((state) => ({
        currentStyle: {
          color: state.currentStyle.color,
          paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
          opacity: value,
          limitValues: state.currentStyle.limitValues,
        },
      }))
    }
  }

  handleColorChange = (color: number[]): void => {
    const identifier = this.props.opticalPath.identifier
    this.setState((state) => ({
      currentStyle: {
        color,
        paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
        opacity: state.currentStyle.opacity,
        limitValues: state.currentStyle.limitValues,
      },
    }))
    this.props.onStyleChange({
      opticalPathIdentifier: identifier,
      styleOptions: { color },
    })
  }

  getCurrentColors = (): string[] => {
    const rgb2hex = (values: number[]): string => {
      const r = values[0]
      const g = values[1]
      const b = values[2]
      return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
    }

    if (this.props.defaultStyle.paletteColorLookupTable != null) {
      const colormap = this.props.defaultStyle.paletteColorLookupTable.data
      return colormap.map((values) => rgb2hex(values))
    } else if (this.state.currentStyle.color != null) {
      return ['#000000', rgb2hex(this.state.currentStyle.color)]
    } else {
      return ['white', 'white']
    }
  }

  handleLowerLimitChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value, 10)
    if (Number.isNaN(value)) return
    const identifier = this.props.opticalPath.identifier
    if (this.state.currentStyle.limitValues !== undefined) {
      this.setState((state) => {
        if (state.currentStyle.limitValues !== undefined) {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              paletteColorLookupTable:
                state.currentStyle.paletteColorLookupTable,
              opacity: state.currentStyle.opacity,
              limitValues: [value, state.currentStyle.limitValues[1]],
            },
          }
        } else {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              paletteColorLookupTable:
                state.currentStyle.paletteColorLookupTable,
              opacity: state.currentStyle.opacity,
              limitValues: state.currentStyle.limitValues,
            },
          }
        }
      })
      this.props.onStyleChange({
        opticalPathIdentifier: identifier,
        styleOptions: {
          limitValues: [value, this.state.currentStyle.limitValues[1]],
        },
      })
    }
  }

  handleUpperLimitChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value, 10)
    if (Number.isNaN(value)) return
    const identifier = this.props.opticalPath.identifier
    if (this.state.currentStyle.limitValues !== undefined) {
      this.setState((state) => {
        if (state.currentStyle.limitValues !== undefined) {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              paletteColorLookupTable:
                state.currentStyle.paletteColorLookupTable,
              opacity: state.currentStyle.opacity,
              limitValues: [state.currentStyle.limitValues[0], value],
            },
          }
        } else {
          return {
            currentStyle: {
              color: state.currentStyle.color,
              paletteColorLookupTable:
                state.currentStyle.paletteColorLookupTable,
              opacity: state.currentStyle.opacity,
              limitValues: state.currentStyle.limitValues,
            },
          }
        }
      })
      this.props.onStyleChange({
        opticalPathIdentifier: identifier,
        styleOptions: {
          limitValues: [this.state.currentStyle.limitValues[0], value],
        },
      })
    }
  }

  handleLimitChange = (values: number[]): void => {
    const identifier = this.props.opticalPath.identifier
    this.setState((state) => ({
      currentStyle: {
        color: state.currentStyle.color,
        paletteColorLookupTable: state.currentStyle.paletteColorLookupTable,
        opacity: state.currentStyle.opacity,
        limitValues: values,
      },
    }))
    this.props.onStyleChange({
      opticalPathIdentifier: identifier,
      styleOptions: { limitValues: values },
    })
  }

  handleRemoval = (): void => {
    const identifier = this.props.opticalPath.identifier
    this.props.onRemoval(identifier)
  }

  private getSwatchBackground(): string {
    if (!this.props.opticalPath.isMonochromatic) {
      return 'linear-gradient(135deg,#e04a4a,#3fb56b,#3a6cf0)'
    }
    const colors = this.getCurrentColors()
    if (this.props.defaultStyle.paletteColorLookupTable != null) {
      return `linear-gradient(90deg, ${colors.join(', ')})`
    }
    return colors[colors.length - 1]
  }

  private getMeta(): string {
    const { opticalPath } = this.props
    if (!opticalPath.isMonochromatic) {
      return this.props.hasIccProfile === true ? 'RGB · ICC profile' : 'RGB'
    }
    if (opticalPath.illuminationWaveLength !== undefined) {
      return `${opticalPath.illuminationWaveLength} nm`
    }
    return opticalPath.illuminationColor?.CodeMeaning ?? ''
  }

  private renderSettings(maxValue: number): React.ReactNode {
    const { currentStyle } = this.state
    const isMonochromatic = this.props.opticalPath.isMonochromatic
    return (
      <div className="flex w-72 flex-col gap-4">
        <div className="text-[12.5px] font-semibold text-ink">
          Display settings
        </div>
        {isMonochromatic && currentStyle.limitValues != null && (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-ink-muted">Values of interest</div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={currentStyle.limitValues[1]}
                className="h-8 w-20 font-mono text-[12px]"
                value={currentStyle.limitValues[0]}
                onChange={this.handleLowerLimitChange}
              />
              <span className="text-ink-faint">–</span>
              <Input
                type="number"
                min={currentStyle.limitValues[0]}
                max={maxValue}
                className="h-8 w-20 font-mono text-[12px]"
                value={currentStyle.limitValues[1]}
                onChange={this.handleUpperLimitChange}
              />
            </div>
          </div>
        )}
        {isMonochromatic && (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-ink-muted">Color</div>
            {currentStyle.color != null ? (
              <ColorSlider
                color={currentStyle.color}
                onChange={this.handleColorChange}
              />
            ) : (
              <p className="text-[12px] text-ink-secondary">
                Pixels are colorized by the embedded palette color lookup table,
                so custom pseudo-coloring is disabled.
              </p>
            )}
          </div>
        )}
        <OpacitySlider
          opacity={currentStyle.opacity}
          onChange={this.handleOpacityChange}
        />
      </div>
    )
  }

  render(): React.ReactNode {
    const { opticalPath } = this.props
    const name = getOpticalPathName(opticalPath)
    const meta = this.getMeta()
    const maxValue = 2 ** this.props.metadata[0].BitsAllocated - 1
    const limitValues = this.state.currentStyle.limitValues

    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 flex-none rounded-[3px] border border-ink/[0.12]"
            style={{ background: this.getSwatchBackground() }}
          />
          <span
            className="min-w-0 truncate font-semibold text-ink"
            title={name}
          >
            {name}
          </span>
          {meta !== '' && (
            <span className="flex-none text-[12px] text-ink-muted">{meta}</span>
          )}
          <span className="ml-auto flex flex-none items-center gap-0.5">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Display settings"
                  aria-label={`Display settings for ${name}`}
                  className="grid h-7 w-7 place-items-center rounded-md text-ink-secondary transition-colors hover:bg-segmented"
                >
                  <Icon name="tune" size={17} />
                </button>
              </PopoverTrigger>
              <PopoverContent side="left" align="start" className="w-auto">
                {this.renderSettings(maxValue)}
              </PopoverContent>
            </Popover>
            {this.props.isRemovable && (
              <button
                type="button"
                title="Remove optical path"
                aria-label={`Remove ${name}`}
                onClick={this.handleRemoval}
                className="grid h-7 w-7 place-items-center rounded-md text-ink-secondary transition-colors hover:bg-segmented"
              >
                <Icon name="close" size={17} />
              </button>
            )}
            <Switch
              size="sm"
              className="ml-1"
              checked={this.state.isVisible}
              onCheckedChange={this.handleVisibilityChange}
              aria-label={`Show ${name}`}
            />
          </span>
        </div>
        {opticalPath.isMonochromatic && limitValues != null && (
          <div className="flex items-center gap-2 text-[11.5px] text-ink-muted">
            Window
            <Slider
              className="flex-1"
              min={0}
              max={maxValue}
              step={1}
              value={[limitValues[0], limitValues[1]]}
              onValueChange={this.handleLimitChange}
            />
          </div>
        )}
      </div>
    )
  }
}

export default OpticalPathItem
