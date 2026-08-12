import { Badge, Space, Switch } from 'antd'
// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import throttle from 'lodash/throttle'
import React, { useCallback } from 'react'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { rgbToHex } from '../utils/segmentColors'
import AnnotationGroupDisplaySettings, {
  type MeasurementOption,
} from './AnnotationGroupDisplaySettings'
import Description from './Description'
import ValidationWarning from './ValidationWarning'

// Helper function components
function AnnotationGroupControls({
  isVisible,
  onVisibilityChange,
  displaySettings,
  color,
}: {
  isVisible: boolean
  onVisibilityChange: (
    checked: boolean,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void
  displaySettings: React.ReactNode
  color: number[]
}): React.ReactElement {
  return (
    <Space direction="vertical" align="center">
      <Switch
        size="small"
        onChange={onVisibilityChange}
        checked={isVisible}
        checkedChildren={<FaEye />}
        unCheckedChildren={<FaEyeSlash />}
      />
      {displaySettings}
      {/* Color indicator */}
      <div
        style={{
          width: '20px',
          height: '20px',
          backgroundColor: rgbToHex(color),
          border: '1px solid #d9d9d9',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={`Annotation group color: ${rgbToHex(color)}`}
      />
    </Space>
  )
}

function AnnotationGroupBadgeDescription({
  annotationGroup,
  onClick,
  isBadgeVisible,
  color,
  label,
  attributes,
}: {
  annotationGroup: dmv.annotation.AnnotationGroup
  onClick: () => void
  isBadgeVisible: boolean
  color: string
  label: string
  attributes: Array<{ name: string; value: string }>
}): React.ReactElement {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onClick()
      }
    },
    [onClick],
  )

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={`Annotation group ${label}`}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <Badge
        offset={[-20, 20]}
        count={' '}
        style={{
          borderStyle: 'solid',
          borderWidth: '1px',
          borderColor: 'gray',
          visibility: isBadgeVisible ? 'visible' : 'hidden',
          backgroundImage: `linear-gradient(to bottom, ${color}, ${color}`,
        }}
      >
        <ValidationWarning
          annotationGroup={annotationGroup}
          style={{ padding: '0.3rem' }}
        />
        <Description
          header={label}
          attributes={attributes}
          selectable
          hasLongValues
        />
      </Badge>
    </button>
  )
}

// Interfaces
interface AnnotationGroupItemProps {
  annotationGroup: dmv.annotation.AnnotationGroup
  isVisible: boolean
  metadata: dmv.metadata.MicroscopyBulkSimpleAnnotations
  defaultStyle: {
    opacity: number
    color: number[]
    filled?: boolean
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
      filled?: boolean
      fillOpacity?: number
      limitValues?: number[]
      measurement?: dcmjs.sr.coding.CodedConcept
    }
  }) => void
  getMeasurementRange?: (
    annotationGroupUID: string,
    measurement: dcmjs.sr.coding.CodedConcept,
  ) => { min: number; max: number } | null
}

interface AnnotationGroupItemState {
  isVisible: boolean
  currentStyle: {
    opacity: number
    color?: number[]
    filled?: boolean
    fillOpacity?: number
    limitValues?: number[]
    measurement?: dcmjs.sr.coding.CodedConcept
  }
}

/** Graphic types that can be meaningfully filled (closed shapes). */
const CLOSED_GRAPHIC_TYPES = new Set(['POLYGON', 'RECTANGLE', 'ELLIPSE'])

/** Matches dicom-microscopy-viewer's BULK_DEFAULT_FILL_OPACITY. */
const DEFAULT_FILL_OPACITY = 0.35

// Class
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
        filled: this.props.defaultStyle.filled ?? false,
        fillOpacity:
          this.props.defaultStyle.fillOpacity ?? DEFAULT_FILL_OPACITY,
      },
    }
  }

  componentWillUnmount(): void {
    this.throttledOnStyleChange.cancel()
  }

  /**
   * Sliders fire on every pixel of drag; forwarding each tick straight into
   * the viewer triggers a full layer rebuild and can make dragging itself
   * feel laggy for large annotation groups. Throttle the expensive call
   * (leading+trailing so the drag start and final value are never dropped)
   * while local state below still updates every tick for a responsive UI.
   */
  private readonly throttledOnStyleChange = throttle(
    (styleOptions: {
      opacity?: number
      color?: number[]
      filled?: boolean
      fillOpacity?: number
      limitValues?: number[]
    }): void => {
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions,
      })
    },
    50,
    { leading: true, trailing: true },
  )

  handleVisibilityChange = (
    checked: boolean,
    _event: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    this.props.onVisibilityChange({
      annotationGroupUID: this.props.annotationGroup.uid,
      isVisible: checked,
    })
    this.setState({ isVisible: checked })
  }

  handleColorChange = (color: number[]): void => {
    this.setState((state) => ({
      currentStyle: {
        color,
        opacity: state.currentStyle.opacity,
        filled: state.currentStyle.filled,
        fillOpacity: state.currentStyle.fillOpacity,
        limitValues: state.currentStyle.limitValues,
      },
    }))
    this.throttledOnStyleChange({ color })
  }

  handleOpacityChange = (opacity: number | null): void => {
    if (opacity !== null) {
      this.throttledOnStyleChange({ opacity })
      this.setState({
        currentStyle: {
          opacity,
          color: this.state.currentStyle.color,
          filled: this.state.currentStyle.filled,
          fillOpacity: this.state.currentStyle.fillOpacity,
          limitValues: this.state.currentStyle.limitValues,
        },
      })
    }
  }

  handleFilledChange = (checked: boolean): void => {
    this.props.onStyleChange({
      uid: this.props.annotationGroup.uid,
      styleOptions: { filled: checked },
    })
    this.setState((state) => ({
      currentStyle: {
        ...state.currentStyle,
        filled: checked,
      },
    }))
  }

  handleFillOpacityChange = (fillOpacity: number | null): void => {
    if (fillOpacity !== null) {
      this.throttledOnStyleChange({ fillOpacity })
      this.setState((state) => ({
        currentStyle: {
          ...state.currentStyle,
          fillOpacity,
        },
      }))
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

  handleLimitChange = (values: number[]): void => {
    this.setState((state) => ({
      currentStyle: {
        color: state.currentStyle.color,
        opacity: state.currentStyle.opacity,
        filled: state.currentStyle.filled,
        fillOpacity: state.currentStyle.fillOpacity,
        limitValues: values,
      },
    }))
    this.throttledOnStyleChange({ limitValues: values })
  }

  handleAnnotationGroupClick = (): void => {
    this.props.onAnnotationGroupClick(this.props.annotationGroup.uid)
  }

  handleMeasurementChange = (option: MeasurementOption | undefined): void => {
    if (option != null) {
      const measurement = new dcmjs.sr.coding.CodedConcept({
        value: option.codeValue,
        schemeDesignator: option.schemeDesignator,
        meaning: option.meaning,
      })
      const range = this.props.getMeasurementRange?.(
        this.props.annotationGroup.uid,
        measurement,
      )
      const limitValues = range != null ? [range.min, range.max] : undefined
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: { measurement, limitValues },
      })
      this.setState((state) => ({
        currentStyle: {
          opacity: state.currentStyle.opacity,
          filled: state.currentStyle.filled,
          fillOpacity: state.currentStyle.fillOpacity,
          measurement,
          limitValues,
        },
      }))
    } else {
      this.props.onStyleChange({
        uid: this.props.annotationGroup.uid,
        styleOptions: {
          color: this.props.defaultStyle.color,
          /** Explicitly clear so the viewer deactivates measurement filtering. */
          measurement: undefined,
        },
      })
      this.setState((state) => ({
        currentStyle: {
          opacity: state.currentStyle.opacity,
          filled: state.currentStyle.filled,
          fillOpacity: state.currentStyle.fillOpacity,
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
      // {
      //   name: 'Algorithm Name',
      //   value: this.props.annotationGroup.algorithmName
      // },
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
    const measurementOptions: MeasurementOption[] = measurementsSequence.map(
      (measurementItem: {
        ConceptNameCodeSequence: Array<{
          CodingSchemeDesignator: string
          CodeValue: string
          CodeMeaning: string
        }>
      }) => {
        const name = measurementItem.ConceptNameCodeSequence[0]
        return {
          key: `${name.CodingSchemeDesignator}-${name.CodeValue}`,
          meaning: name.CodeMeaning,
          schemeDesignator: name.CodingSchemeDesignator,
          codeValue: name.CodeValue,
        }
      },
    )
    const selectedMeasurement = this.state.currentStyle.measurement
    const selectedMeasurementKey =
      selectedMeasurement != null
        ? `${selectedMeasurement.schemeDesignator}-${selectedMeasurement.value}`
        : undefined
    const limitValues =
      this.state.currentStyle.limitValues != null
        ? ([
            this.state.currentStyle.limitValues[0],
            this.state.currentStyle.limitValues[1],
          ] as [number, number])
        : undefined
    const isClosedGraphicType = CLOSED_GRAPHIC_TYPES.has(item.GraphicType)

    const displaySettings = (
      <AnnotationGroupDisplaySettings
        color={this.state.currentStyle.color}
        onColorChange={this.handleColorChange}
        opacity={this.state.currentStyle.opacity}
        onOpacityChange={this.handleOpacityChange}
        isClosedGraphicType={isClosedGraphicType}
        filled={this.state.currentStyle.filled ?? false}
        onFilledChange={this.handleFilledChange}
        fillOpacity={
          this.state.currentStyle.fillOpacity ?? DEFAULT_FILL_OPACITY
        }
        onFillOpacityChange={this.handleFillOpacityChange}
        measurementOptions={measurementOptions}
        selectedMeasurementKey={selectedMeasurementKey}
        onMeasurementChange={this.handleMeasurementChange}
        limitValues={limitValues}
        limitBounds={[0, 1000]}
        onLimitValuesChange={this.handleLimitChange}
        disabled={!this.props.isVisible}
      />
    )

    const color = this.getCurrentColor()
    const isBadgeVisible =
      this.state.isVisible && this.state.currentStyle.measurement === null
    return (
      <Space align="start">
        <div style={{ paddingLeft: '14px' }}>
          <AnnotationGroupControls
            isVisible={this.props.isVisible}
            onVisibilityChange={this.handleVisibilityChange}
            displaySettings={displaySettings}
            color={this.state.currentStyle.color ?? [255, 255, 255]}
          />
        </div>
        <AnnotationGroupBadgeDescription
          onClick={this.handleAnnotationGroupClick}
          annotationGroup={this.props.annotationGroup}
          isBadgeVisible={isBadgeVisible}
          color={color}
          label={this.props.annotationGroup.label}
          attributes={attributes}
        />
      </Space>
    )
  }
}

export default AnnotationGroupItem
