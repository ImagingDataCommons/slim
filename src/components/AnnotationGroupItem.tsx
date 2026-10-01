// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'

import { cn } from '../lib/utils'
import {
  describeAnnotationGroup,
  getAnnotationGroupItem,
  getMeasurementOptions,
  isFillableGraphicType,
} from '../utils/annotationGroup'
import { formatGroupedNumber } from '../utils/displayFormat'
import { clampLimitValues, type LimitSide } from '../utils/limits'
import { rgbToHex } from '../utils/segmentColors'
import ColorSlider from './ColorSlider'
import OpacitySlider from './OpacitySlider'
import { InfoTooltipButton } from './slim/InfoTooltipButton'
import { LimitInput } from './slim/LimitInput'
import { Icon } from './ui/icon'
import { Input } from './ui/input'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import ValidationWarning from './ValidationWarning'

const SETTINGS_LABEL = 'mb-2 text-[12px] text-ink-muted'
const NO_MEASUREMENT = '-'
/** The viewer does not expose measurement value ranges yet */
const LIMIT_MIN = 0
const LIMIT_MAX = 1000

/** Interfaces */
interface AnnotationGroupItemProps {
  annotationGroup: dmv.annotation.AnnotationGroup
  isVisible: boolean
  metadata: dmv.metadata.MicroscopyBulkSimpleAnnotations
  defaultStyle: {
    opacity: number
    color: number[]
    fill?: boolean
    fillOpacity?: number
  }
  onAnnotationGroupClick: (annotationGroupUID: string) => void
  onVisibilityChange: ({
    annotationGroupUID,
    isVisible,
  }: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onStyleChange: ({
    uid,
    styleOptions,
  }: {
    uid: string
    styleOptions: {
      opacity?: number
      color?: number[]
      limitValues?: number[]
      measurement?: dcmjs.sr.coding.CodedConcept
      fill?: boolean
      fillOpacity?: number
    }
  }) => void
}

interface AnnotationGroupItemState {
  /** Select value; survives the settings popover unmounting */
  selectedMeasurementKey: string
  currentStyle: {
    opacity: number
    color?: number[]
    limitValues?: number[]
    measurement?: dcmjs.sr.coding.CodedConcept
    fill?: boolean
    fillOpacity?: number
  }
}

/**
 * React component representing an Annotation Group.
 */
class AnnotationGroupItem extends React.Component<
  AnnotationGroupItemProps,
  AnnotationGroupItemState
> {
  constructor(props: AnnotationGroupItemProps) {
    super(props)
    this.state = {
      selectedMeasurementKey: NO_MEASUREMENT,
      currentStyle: {
        opacity: this.props.defaultStyle.opacity,
        color: this.props.defaultStyle.color,
        fill: this.props.defaultStyle.fill ?? false,
        fillOpacity: this.props.defaultStyle.fillOpacity ?? 0.5,
      },
    }
  }

  handleVisibilityChange = (checked: boolean): void => {
    this.props.onVisibilityChange({
      annotationGroupUID: this.props.annotationGroup.uid,
      isVisible: checked,
    })
  }

  handleColorChange = (color: number[]): void => {
    this.setState((state) => ({
      currentStyle: {
        ...state.currentStyle,
        color,
      },
    }))
    this.props.onStyleChange({
      uid: this.props.annotationGroup.uid,
      styleOptions: { color },
    })
  }

  handleOpacityChange = (opacity: number | null): void => {
    if (opacity !== null) {
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: {
          opacity,
        },
      })
      this.setState((state) => ({
        currentStyle: {
          ...state.currentStyle,
          opacity,
        },
      }))
    }
  }

  handleFillChange = (checked: boolean): void => {
    this.props.onStyleChange({
      uid: this.props.annotationGroup.uid,
      styleOptions: {
        fill: checked,
      },
    })
    this.setState((state) => ({
      currentStyle: {
        ...state.currentStyle,
        fill: checked,
      },
    }))
  }

  handleFillOpacityChange = (fillOpacity: number | null): void => {
    if (fillOpacity !== null) {
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: {
          fillOpacity,
        },
      })
      this.setState((state) => ({
        currentStyle: {
          ...state.currentStyle,
          fillOpacity,
        },
      }))
    }
  }

  handleFillOpacitySliderChange = (values: number[]): void => {
    this.handleFillOpacityChange(values[0])
  }

  handleFillOpacityInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const value = parseFloat(e.target.value)
    if (!Number.isNaN(value)) {
      this.handleFillOpacityChange(Math.min(1, Math.max(0, value)))
    }
  }

  private applyLimitValues(
    values: number[],
    edited: LimitSide = 'lower',
  ): void {
    const limitValues = clampLimitValues(values, LIMIT_MIN, LIMIT_MAX, edited)
    this.setState((state) => ({
      currentStyle: { ...state.currentStyle, limitValues },
    }))
    this.props.onStyleChange({
      uid: this.props.annotationGroup.uid,
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

  handleAnnotationGroupClick = (): void => {
    this.props.onAnnotationGroupClick(this.props.annotationGroup.uid)
  }

  handleMeasurementSelection = (key: string): void => {
    const item = getAnnotationGroupItem(
      this.props.metadata,
      this.props.annotationGroup.uid,
    )
    const option =
      key === NO_MEASUREMENT
        ? undefined
        : getMeasurementOptions(item).find((candidate) => candidate.key === key)
    if (option !== undefined) {
      const measurement = new dcmjs.sr.coding.CodedConcept({
        value: option.value,
        schemeDesignator: option.schemeDesignator,
        meaning: option.meaning,
      })
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: { measurement },
      })
      this.setState((state) => ({
        selectedMeasurementKey: option.key,
        currentStyle: { ...state.currentStyle, measurement },
      }))
      return
    }
    this.props.onStyleChange({
      uid: this.props.annotationGroup.uid,
      styleOptions: { color: this.props.defaultStyle.color },
    })
    this.setState((state) => ({
      selectedMeasurementKey: NO_MEASUREMENT,
      currentStyle: {
        ...state.currentStyle,
        color: this.props.defaultStyle.color,
        limitValues: undefined,
        measurement: undefined,
      },
    }))
  }

  render(): React.ReactNode {
    const item = getAnnotationGroupItem(
      this.props.metadata,
      this.props.annotationGroup.uid,
    )
    const { meta, attributes, count } = describeAnnotationGroup(
      this.props.annotationGroup,
      item,
      this.props.metadata?.AnnotationCoordinateType,
    )
    const measurementOptions = getMeasurementOptions(item)
    const isColoredByMeasurement =
      this.state.selectedMeasurementKey !== NO_MEASUREMENT

    let colorSettings: React.ReactNode
    if (
      this.state.currentStyle.color !== null &&
      this.state.currentStyle.color !== undefined &&
      this.state.currentStyle.color.length === 3
    ) {
      colorSettings = (
        <div>
          <p className={SETTINGS_LABEL}>Color</p>
          <ColorSlider
            color={this.state.currentStyle.color}
            onChange={this.handleColorChange}
          />
        </div>
      )
    }

    let windowSettings: React.ReactNode
    let explorationSettings: React.ReactNode
    if (measurementOptions.length > 0) {
      const limitValues = this.state.currentStyle.limitValues
      if (limitValues !== null && limitValues !== undefined) {
        windowSettings = (
          <div>
            <p className={SETTINGS_LABEL}>Values of interest</p>
            <div className="flex items-center gap-2">
              <LimitInput
                aria-label="Lower limit"
                min={LIMIT_MIN}
                max={limitValues[1]}
                value={limitValues[0]}
                onCommit={this.handleLowerLimitCommit}
              />
              <Slider
                className="flex-1"
                min={LIMIT_MIN}
                max={LIMIT_MAX}
                step={1}
                value={[limitValues[0], limitValues[1]]}
                onValueChange={this.handleLimitChange}
                thumbLabels={['Lower limit', 'Upper limit']}
              />
              <LimitInput
                aria-label="Upper limit"
                min={limitValues[0]}
                max={LIMIT_MAX}
                value={limitValues[1]}
                onCommit={this.handleUpperLimitCommit}
              />
            </div>
          </div>
        )
      }
      explorationSettings = (
        <div>
          <p className={SETTINGS_LABEL}>Color by measurement</p>
          <Select
            value={this.state.selectedMeasurementKey}
            onValueChange={this.handleMeasurementSelection}
          >
            <SelectTrigger className="w-full" aria-label="Color by measurement">
              <SelectValue placeholder="Select measurement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MEASUREMENT}>None</SelectItem>
              {measurementOptions.map((opt) => (
                <SelectItem
                  key={opt.key}
                  value={opt.key}
                  disabled={!this.props.isVisible}
                >
                  {opt.meaning}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }

    /** Fill settings for POLYGON, RECTANGLE, ELLIPSE graphic types */
    let fillSettings: React.ReactNode
    if (isFillableGraphicType(item?.GraphicType)) {
      fillSettings = (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-ink">Fill</span>
            <Switch
              size="sm"
              checked={this.state.currentStyle.fill ?? false}
              onCheckedChange={this.handleFillChange}
              aria-label="Fill shapes"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-none text-[12px] text-ink-muted">
              Fill opacity
            </span>
            <Slider
              className="flex-1"
              min={0}
              max={1}
              step={0.01}
              value={[this.state.currentStyle.fillOpacity ?? 0.5]}
              onValueChange={this.handleFillOpacitySliderChange}
              disabled={this.state.currentStyle.fill !== true}
              aria-label="Fill opacity"
            />
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              aria-label="Fill opacity value"
              className="h-8 w-16 font-mono text-[12px]"
              value={this.state.currentStyle.fillOpacity ?? 0.5}
              onChange={this.handleFillOpacityInputChange}
              disabled={this.state.currentStyle.fill !== true}
            />
          </div>
        </div>
      )
    }

    const settings = (
      <div className="flex w-80 flex-col gap-4">
        <div className="text-[12.5px] font-semibold text-ink">
          Display settings
        </div>
        {colorSettings}
        {windowSettings}
        <OpacitySlider
          opacity={this.state.currentStyle.opacity}
          onChange={this.handleOpacityChange}
        />
        {fillSettings}
        {explorationSettings}
      </div>
    )

    const label = this.props.annotationGroup.label
    const color = this.state.currentStyle.color

    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2">
        {isColoredByMeasurement ? (
          <Icon
            name="gradient"
            size={14}
            className="flex-none text-ink-muted"
            title="Colored by measurement"
          />
        ) : (
          <span
            className={cn(
              'h-2.5 w-2.5 flex-none rounded-full',
              color === undefined && 'border border-line bg-panel',
            )}
            style={color !== undefined ? { background: rgbToHex(color) } : {}}
          />
        )}
        <button
          type="button"
          onClick={this.handleAnnotationGroupClick}
          className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
          title="Zoom to annotation group"
        >
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-ink">{label}</span>
            <ValidationWarning
              annotationGroup={this.props.annotationGroup}
              size={15}
            />
          </span>
          {meta !== '' && (
            <span className="truncate text-[12px] text-ink-muted">{meta}</span>
          )}
        </button>
        {count !== undefined && (
          <span className="flex-none font-mono text-[11.5px] font-medium text-ink-secondary">
            {formatGroupedNumber(count)}
          </span>
        )}
        <InfoTooltipButton
          label={`Details for ${label}`}
          attributes={attributes}
        />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Display settings"
              aria-label={`Display settings for ${label}`}
              className="grid h-7 w-7 flex-none place-items-center rounded-md text-ink-secondary transition-colors hover:bg-segmented"
            >
              <Icon name="tune" size={17} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="left" align="start" className="w-auto">
            {settings}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          title="Show/hide"
          aria-label={this.props.isVisible ? `Hide ${label}` : `Show ${label}`}
          onClick={() => this.handleVisibilityChange(!this.props.isVisible)}
          className={cn(
            'grid h-7 w-7 flex-none place-items-center rounded-md transition-colors hover:bg-segmented',
            this.props.isVisible ? 'text-ink-secondary' : 'text-ink-fainter',
          )}
        >
          <Icon
            name={this.props.isVisible ? 'visibility' : 'visibility_off'}
            size={18}
          />
        </button>
      </div>
    )
  }
}

export default AnnotationGroupItem
