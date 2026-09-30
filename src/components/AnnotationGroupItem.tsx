// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'

import { cn } from '../lib/utils'
import { formatGroupedNumber } from '../utils/displayFormat'
import ColorSlider from './ColorSlider'
import OpacitySlider from './OpacitySlider'
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
  isVisible: boolean
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
      isVisible: this.props.isVisible,
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
    this.setState({ isVisible: checked })
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

  handleLowerLimitChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value, 10)
    if (Number.isNaN(value)) return
    if (this.state.currentStyle.limitValues !== undefined) {
      this.setState((state) => {
        if (state.currentStyle.limitValues !== undefined) {
          return {
            currentStyle: {
              ...state.currentStyle,
              limitValues: [value, state.currentStyle.limitValues[1]],
            },
          }
        } else {
          return { currentStyle: state.currentStyle }
        }
      })
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: {
          limitValues: [value, this.state.currentStyle.limitValues[1]],
        },
      })
    }
  }

  handleUpperLimitChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value, 10)
    if (Number.isNaN(value)) return
    if (this.state.currentStyle.limitValues !== undefined) {
      this.setState((state) => {
        if (state.currentStyle.limitValues !== undefined) {
          return {
            currentStyle: {
              ...state.currentStyle,
              limitValues: [state.currentStyle.limitValues[0], value],
            },
          }
        } else {
          return { currentStyle: state.currentStyle }
        }
      })
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: {
          limitValues: [this.state.currentStyle.limitValues[0], value],
        },
      })
    }
  }

  handleLimitChange = (values: number[]): void => {
    this.setState((state) => ({
      currentStyle: {
        ...state.currentStyle,
        limitValues: values,
      },
    }))
    this.props.onStyleChange({
      uid: this.props.annotationGroup.uid,
      styleOptions: { limitValues: values },
    })
  }

  handleAnnotationGroupClick = (): void => {
    this.props.onAnnotationGroupClick(this.props.annotationGroup.uid)
  }

  handleMeasurementSelection = (value: string): void => {
    if (value && value !== '-') {
      const codeComponents = value.split('-')
      /** Need to look up the code meaning from the measurements sequence */
      const index = this.props.metadata.AnnotationGroupSequence.findIndex(
        (item) => item.AnnotationGroupUID === this.props.annotationGroup.uid,
      )
      const item = this.props.metadata.AnnotationGroupSequence[index]
      const measurementsSequence = item.MeasurementsSequence ?? []
      const matchingMeasurement = measurementsSequence.find((m) => {
        const name = m.ConceptNameCodeSequence[0]
        return `${name.CodingSchemeDesignator}-${name.CodeValue}` === value
      })
      if (matchingMeasurement) {
        const name = matchingMeasurement.ConceptNameCodeSequence[0]
        const measurement = new dcmjs.sr.coding.CodedConcept({
          value: codeComponents[1],
          schemeDesignator: codeComponents[0],
          meaning: name.CodeMeaning,
        })
        this.props.onStyleChange({
          uid: this.props.annotationGroup.uid,
          styleOptions: { measurement },
        })
        this.setState((state) => ({
          currentStyle: {
            ...state.currentStyle,
            measurement,
          },
        }))
      }
    } else {
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: {
          color: this.props.defaultStyle.color,
        },
      })
      this.setState((state) => ({
        currentStyle: {
          ...state.currentStyle,
          color: this.props.defaultStyle.color,
          limitValues: undefined,
        },
      }))
    }
  }

  render(): React.ReactNode {
    const index = this.props.metadata.AnnotationGroupSequence.findIndex(
      (item) => item.AnnotationGroupUID === this.props.annotationGroup.uid,
    )
    const item = this.props.metadata.AnnotationGroupSequence[index]
    const attributes: Array<{ name: string; value: string }> = [
      {
        name: 'Property type',
        value: this.props.annotationGroup.propertyType.CodeMeaning,
      },
      {
        name: 'Property category',
        value: this.props.annotationGroup.propertyCategory.CodeMeaning,
      },
      {
        name: 'Graphic type',
        value: item.GraphicType,
      },
      {
        name: 'Annotation coordinate type',
        value: this.props.metadata.AnnotationCoordinateType,
      },
    ]

    const measurementsSequence = item.MeasurementsSequence ?? []
    const measurementOptions = measurementsSequence.map((measurementItem) => {
      const name = measurementItem.ConceptNameCodeSequence[0]
      const key = `${name.CodingSchemeDesignator}-${name.CodeValue}`
      return { key, meaning: name.CodeMeaning }
    })

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
    if (measurementsSequence.length > 0) {
      if (
        this.state.currentStyle.limitValues !== null &&
        this.state.currentStyle.limitValues !== undefined
      ) {
        const minValue = 0
        const maxValue = 1000
        windowSettings = (
          <div>
            <p className={SETTINGS_LABEL}>Values of interest</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={this.state.currentStyle.limitValues[1]}
                className="h-8 w-20 font-mono text-[12px]"
                value={this.state.currentStyle.limitValues[0]}
                onChange={this.handleLowerLimitChange}
              />
              <Slider
                className="flex-1"
                min={minValue}
                max={maxValue}
                step={1}
                value={[
                  this.state.currentStyle.limitValues[0],
                  this.state.currentStyle.limitValues[1],
                ]}
                onValueChange={this.handleLimitChange}
              />
              <Input
                type="number"
                min={this.state.currentStyle.limitValues[0]}
                max={maxValue}
                className="h-8 w-20 font-mono text-[12px]"
                value={this.state.currentStyle.limitValues[1]}
                onChange={this.handleUpperLimitChange}
              />
            </div>
          </div>
        )
      }
      explorationSettings = (
        <div>
          <p className={SETTINGS_LABEL}>Color by measurement</p>
          <Select
            onValueChange={this.handleMeasurementSelection}
            defaultValue="-"
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select measurement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-">None</SelectItem>
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
    if (
      item.GraphicType === 'POLYGON' ||
      item.GraphicType === 'RECTANGLE' ||
      item.GraphicType === 'ELLIPSE'
    ) {
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
            />
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
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
    const meta = [
      this.props.annotationGroup.propertyType.CodeMeaning,
      item.GraphicType?.toLowerCase(),
    ]
      .filter((part) => part !== undefined && part !== '')
      .join(' · ')
    const numberOfAnnotations = (item as { NumberOfAnnotations?: number })
      .NumberOfAnnotations

    return (
      <div
        className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2"
        title={attributes.map((a) => `${a.name}: ${a.value}`).join('\n')}
      >
        <span
          className="h-2.5 w-2.5 flex-none rounded-full"
          style={{ background: this.getCurrentColor() }}
        />
        <button
          type="button"
          onClick={this.handleAnnotationGroupClick}
          className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
          aria-label={`Annotation group ${label}`}
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
        {numberOfAnnotations !== undefined && (
          <span className="flex-none font-mono text-[11.5px] font-medium text-ink-secondary">
            {formatGroupedNumber(numberOfAnnotations)}
          </span>
        )}
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
