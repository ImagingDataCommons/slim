// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'

import { cn } from '../lib/utils'
import { clampLimitValues, type LimitSide } from '../utils/limits'
import {
  getOpticalPathMeta,
  getOpticalPathName,
  getOpticalPathSwatch,
} from '../utils/opticalPath'
import { getSpecimenStains } from '../utils/specimen'
import ColorSlider from './ColorSlider'
import OpacitySlider from './OpacitySlider'
import { LimitInput } from './slim/LimitInput'
import { Icon } from './ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'

const LIMIT_LABELS = ['Lower limit', 'Upper limit']

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

  private getMaxValue(): number {
    const bitsAllocated = this.props.metadata[0]?.BitsAllocated ?? 8
    return 2 ** bitsAllocated - 1
  }

  private applyLimitValues(
    values: number[],
    edited: LimitSide = 'lower',
  ): void {
    const limitValues = clampLimitValues(values, 0, this.getMaxValue(), edited)
    this.setState((state) => ({
      currentStyle: { ...state.currentStyle, limitValues },
    }))
    this.props.onStyleChange({
      opticalPathIdentifier: this.props.opticalPath.identifier,
      styleOptions: { limitValues },
    })
  }

  handleLowerLimitCommit = (value: number): void => {
    const limitValues = this.state.currentStyle.limitValues
    if (limitValues === undefined) return
    this.applyLimitValues([value, limitValues[1]], 'lower')
  }

  handleUpperLimitCommit = (value: number): void => {
    const limitValues = this.state.currentStyle.limitValues
    if (limitValues === undefined) return
    this.applyLimitValues([limitValues[0], value], 'upper')
  }

  handleLimitChange = (values: number[]): void => {
    this.applyLimitValues(values)
  }

  handleRemoval = (): void => {
    const identifier = this.props.opticalPath.identifier
    this.props.onRemoval(identifier)
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
              <LimitInput
                integer
                aria-label={LIMIT_LABELS[0]}
                min={0}
                max={currentStyle.limitValues[1]}
                value={currentStyle.limitValues[0]}
                onCommit={this.handleLowerLimitCommit}
              />
              <span className="text-ink-faint">–</span>
              <LimitInput
                integer
                aria-label={LIMIT_LABELS[1]}
                min={currentStyle.limitValues[0]}
                max={maxValue}
                value={currentStyle.limitValues[1]}
                onCommit={this.handleUpperLimitCommit}
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
    const meta = getOpticalPathMeta(opticalPath, {
      hasIccProfile: this.props.hasIccProfile,
      stains: getSpecimenStains(
        this.props.metadata[0]?.SpecimenDescriptionSequence,
      ),
    })
    const swatch = getOpticalPathSwatch(opticalPath, {
      color: this.state.currentStyle.color,
      paletteColorLookupTable: this.props.defaultStyle.paletteColorLookupTable,
    })
    const maxValue = this.getMaxValue()
    const limitValues = this.state.currentStyle.limitValues

    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-3 w-3 flex-none rounded-[3px] border border-ink/[0.12]',
              swatch === undefined && 'bg-panel',
            )}
            style={swatch !== undefined ? { background: swatch } : undefined}
          />
          <span
            className="max-w-[65%] flex-none truncate font-semibold text-ink"
            title={name}
          >
            {name}
          </span>
          {meta !== '' && (
            <span
              className="min-w-0 flex-1 truncate text-[12px] text-ink-muted"
              title={meta}
            >
              {meta}
            </span>
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
              checked={this.props.isVisible}
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
              thumbLabels={LIMIT_LABELS.map((label) => `${name} ${label}`)}
            />
          </div>
        )}
      </div>
    )
  }
}

export default OpticalPathItem
