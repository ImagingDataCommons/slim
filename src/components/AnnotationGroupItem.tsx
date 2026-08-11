import { SettingOutlined } from '@ant-design/icons'
import type { SelectProps } from 'antd'
import {
  Badge,
  Button,
  Col,
  Divider,
  InputNumber,
  Popover,
  Progress,
  Row,
  Select,
  Slider,
  Space,
  Spin,
  Switch,
  Tooltip,
} from 'antd'
// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React, { useCallback } from 'react'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { rgbToHex } from '../utils/segmentColors'
import ColorSlider from './ColorSlider'
import Description from './Description'
import OpacitySlider from './OpacitySlider'
import ValidationWarning from './ValidationWarning'

/** Formats a byte count as a short human-readable string, e.g. "1.2 MB". */
function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Loading indicator for an annotation group being retrieved/rendered.
 * Shows byte progress when known (e.g. Range-based streaming reports a
 * total), otherwise an indeterminate spinner.
 */
function AnnotationGroupLoadIndicator({
  loadedBytes,
  totalBytes,
}: {
  loadedBytes: number
  totalBytes: number | null
}): React.ReactElement {
  if (totalBytes !== null && totalBytes > 0) {
    const percent = Math.min(100, Math.round((loadedBytes / totalBytes) * 100))
    return (
      <Tooltip
        title={`Loading annotations: ${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)}`}
      >
        <Progress type="circle" percent={percent} width={20} />
      </Tooltip>
    )
  }
  return (
    <Tooltip title={`Loading annotations: ${formatBytes(loadedBytes)}`}>
      <Spin size="small" />
    </Tooltip>
  )
}

// Helper function components
function AnnotationGroupControls({
  isVisible,
  onVisibilityChange,
  settings,
  color,
  loadStatus,
}: {
  isVisible: boolean
  onVisibilityChange: (
    checked: boolean,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void
  settings: React.ReactNode
  color: number[]
  loadStatus?: {
    loadedBytes: number
    totalBytes: number | null
  }
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
      {loadStatus !== undefined && (
        <AnnotationGroupLoadIndicator
          loadedBytes={loadStatus.loadedBytes}
          totalBytes={loadStatus.totalBytes}
        />
      )}
      <Popover
        placement="left"
        content={settings}
        overlayStyle={{ width: '350px' }}
        title="Display Settings"
      >
        <Button type="primary" shape="circle" icon={<SettingOutlined />} />
      </Popover>
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
  getMeasurementRange?: (
    annotationGroupUID: string,
    measurement: dcmjs.sr.coding.CodedConcept,
  ) => { min: number; max: number } | null
  loadStatus?: {
    loadedBytes: number
    totalBytes: number | null
  }
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
        fill: this.props.defaultStyle.fill ?? false,
        fillOpacity: this.props.defaultStyle.fillOpacity ?? 0.5,
      },
    }
  }

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

  handleLowerLimitChange = (value: number | null): void => {
    if (
      value !== null &&
      value !== undefined &&
      this.state.currentStyle.limitValues !== undefined
    ) {
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

  handleUpperLimitChange = (value: number | null): void => {
    if (
      value !== null &&
      value !== undefined &&
      this.state.currentStyle.limitValues !== undefined
    ) {
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

  handleMeasurementSelection: SelectProps['onChange'] = (value, option) => {
    if (
      value !== null &&
      value !== undefined &&
      option !== null &&
      option !== undefined &&
      Array.isArray(option) &&
      option.length > 0 &&
      option[0] !== null &&
      option[0] !== undefined &&
      option[0].children !== null &&
      option[0].children !== undefined
    ) {
      const codeComponents = value.split('-')
      const measurement = new dcmjs.sr.coding.CodedConcept({
        value: codeComponents[1],
        schemeDesignator: codeComponents[0],
        meaning: Array.isArray(option[0].children)
          ? String(option[0].children[0])
          : String(option[0].children),
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
          ...state.currentStyle,
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
    const createMeasurementOption = (measurementItem: {
      ConceptNameCodeSequence: Array<{
        CodingSchemeDesignator: string
        CodeValue: string
        CodeMeaning: string
      }>
    }): React.ReactElement => {
      const name = measurementItem.ConceptNameCodeSequence[0]
      const key = `${name.CodingSchemeDesignator}-${name.CodeValue}`
      return (
        <Select.Option
          key={key}
          value={key}
          dropdownMatchSelectWidth={false}
          size="small"
          disabled={!this.props.isVisible}
        >
          {name.CodeMeaning}
        </Select.Option>
      )
    }
    const measurementOptions = measurementsSequence.map(createMeasurementOption)
    measurementOptions.push(
      <Select.Option
        key="-"
        value={undefined}
        dropdownMatchSelectWidth={false}
        size="small"
        disabled={!this.props.isVisible}
      >
        {null}
      </Select.Option>,
    )

    let colorSettings: React.ReactNode
    if (
      this.state.currentStyle.color !== null &&
      this.state.currentStyle.color !== undefined &&
      this.state.currentStyle.color.length === 3
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

    let windowSettings: React.ReactNode
    let explorationSettings: React.ReactNode
    if (measurementsSequence.length > 0) {
      if (
        this.state.currentStyle.limitValues !== null &&
        this.state.currentStyle.limitValues !== undefined
      ) {
        // TODO: need to get default min/max values from viewer first
        const minValue = 0
        const maxValue = 1000
        windowSettings = (
          <>
            <Divider plain>Values of interest</Divider>
            <Row justify="center" align="middle" gutter={[8, 8]}>
              <Col span={6}>
                <InputNumber
                  min={0}
                  max={this.state.currentStyle.limitValues[1]}
                  size="small"
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
                    this.state.currentStyle.limitValues[1],
                  ]}
                  onChange={this.handleLimitChange}
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={this.state.currentStyle.limitValues[0]}
                  max={maxValue}
                  size="small"
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
          <Divider plain>Exploration</Divider>
          <Row justify="start" align="middle" gutter={[8, 8]}>
            <Col span={8}>Measurement</Col>
            <Col span={16}>
              <Select
                style={{ minWidth: '65px', width: '90%' }}
                onSelect={this.handleMeasurementSelection}
                key="annotation-group-measurements"
                defaultValue={undefined}
              >
                {measurementOptions}
              </Select>
            </Col>
          </Row>
        </>
      )
    }

    // Fill settings for POLYGON, RECTANGLE, ELLIPSE graphic types
    let fillSettings: React.ReactNode
    if (
      item.GraphicType === 'POLYGON' ||
      item.GraphicType === 'RECTANGLE' ||
      item.GraphicType === 'ELLIPSE'
    ) {
      fillSettings = (
        <>
          <Divider plain>Fill</Divider>
          <Row justify="start" align="middle" gutter={[8, 8]}>
            <Col span={8}>Enable fill</Col>
            <Col span={16}>
              <Switch
                size="small"
                checked={this.state.currentStyle.fill ?? false}
                onChange={this.handleFillChange}
              />
            </Col>
          </Row>
          <Row
            justify="start"
            align="middle"
            gutter={[8, 8]}
            style={{ marginTop: '8px' }}
          >
            <Col span={8}>Fill opacity</Col>
            <Col span={12}>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={this.state.currentStyle.fillOpacity ?? 0.5}
                onChange={this.handleFillOpacityChange}
                disabled={!this.state.currentStyle.fill}
              />
            </Col>
            <Col span={4}>
              <InputNumber
                min={0}
                max={1}
                step={0.01}
                size="small"
                style={{ width: '55px' }}
                value={this.state.currentStyle.fillOpacity ?? 0.5}
                onChange={this.handleFillOpacityChange}
                disabled={!this.state.currentStyle.fill}
              />
            </Col>
          </Row>
        </>
      )
    }

    const settings = (
      <div>
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

    const color = this.getCurrentColor()
    const isBadgeVisible =
      this.state.isVisible && this.state.currentStyle.measurement === null
    return (
      <Space align="start">
        <div style={{ paddingLeft: '14px' }}>
          <AnnotationGroupControls
            isVisible={this.props.isVisible}
            onVisibilityChange={this.handleVisibilityChange}
            settings={settings}
            color={this.state.currentStyle.color ?? [255, 255, 255]}
            loadStatus={this.props.loadStatus}
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
