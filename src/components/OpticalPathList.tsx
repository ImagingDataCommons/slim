/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import { buildOpticalPathDisplayOptions } from '../utils/displayOptions'
import OpticalPathItem from './OpticalPathItem'
import {
  bindDisplayOptions,
  DisplayOptionsPanel,
} from './slim/DisplayOptionsPanel'
import { Button } from './ui/button'
import { Icon } from './ui/icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

interface DisplaySettings {
  iccProfileEnabled: boolean
  gammaEnabled: boolean
}

interface OpticalPathListProps {
  opticalPaths: dmv.opticalPath.OpticalPath[]
  metadata: {
    [opticalPathIdentifier: string]: dmv.metadata.VLWholeSlideMicroscopyImage[]
  }
  visibleOpticalPathIdentifiers: Set<string>
  activeOpticalPathIdentifiers: Set<string>
  defaultOpticalPathStyles: {
    [opticalPathIdentifier: string]: {
      opacity: number
      color?: number[]
      limitValues?: number[]
      paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
    }
  }
  onOpticalPathVisibilityChange: ({
    opticalPathIdentifier,
    isVisible,
  }: {
    opticalPathIdentifier: string
    isVisible: boolean
  }) => void
  onOpticalPathStyleChange: ({
    opticalPathIdentifier,
    styleOptions,
  }: {
    opticalPathIdentifier: string
    styleOptions: {
      opacity?: number
      color?: number[]
      limitValues?: number[]
    }
  }) => void
  onOpticalPathActivityChange: ({
    opticalPathIdentifier,
    isActive,
  }: {
    opticalPathIdentifier: string
    isActive: boolean
  }) => void
  selectedPresentationStateUID?: string
  /** Display settings for ICC profiles and gamma correction */
  displaySettings?: DisplaySettings
  /** Callback when display settings change */
  onDisplaySettingsChange?: (settings: DisplaySettings) => void
  /** Whether ICC profiles are available for this slide */
  hasIccProfiles?: boolean
}

interface OpticalPathListState {
  selectedOpticalPathIdentifier?: string
}

/**
 * React component representing a list of optical paths.
 */
class OpticalPathList extends React.Component<
  OpticalPathListProps,
  OpticalPathListState
> {
  state = {
    selectedOpticalPathIdentifier: undefined,
  }

  constructor(props: OpticalPathListProps) {
    super(props)
    this.handleItemAddition = this.handleItemAddition.bind(this)
    this.handleItemRemoval = this.handleItemRemoval.bind(this)
    this.handleItemSelectionChange = this.handleItemSelectionChange.bind(this)
  }

  /** Handler that gets called when an optical path should be removed. */
  handleItemRemoval(opticalPathIdentifier: string): void {
    this.props.onOpticalPathActivityChange({
      opticalPathIdentifier,
      isActive: false,
    })
  }

  /** Handler that gets called when the selection of an optical path should change. */
  handleItemSelectionChange(value: string): void {
    this.setState({ selectedOpticalPathIdentifier: value })
  }

  /** Handler that gets called when an optical path should be added. */
  handleItemAddition(): void {
    const identifier = this.state.selectedOpticalPathIdentifier
    if (identifier !== undefined) {
      this.props.onOpticalPathActivityChange({
        opticalPathIdentifier: identifier,
        isActive: true,
      })
      this.setState({ selectedOpticalPathIdentifier: undefined })
    }
  }

  render(): React.ReactNode {
    if (this.props.metadata === undefined) {
      return null
    }

    const isSelectable = this.props.opticalPaths.length > 1
    const opticalPathItems: React.ReactNode[] = []
    const optionItems: { id: string; title: string }[] = []
    this.props.opticalPaths.forEach((opticalPath) => {
      const opticalPathIdentifier = opticalPath.identifier
      const images = this.props.metadata[opticalPathIdentifier]
      const seriesInstanceUID = images[0].SeriesInstanceUID
      images[0].OpticalPathSequence.forEach((opticalPathItem) => {
        const id = opticalPathItem.OpticalPathIdentifier
        const description = opticalPathItem.OpticalPathDescription
        if (opticalPath.identifier === id) {
          if (this.props.activeOpticalPathIdentifiers.has(id)) {
            opticalPathItems.push(
              <OpticalPathItem
                key={`${seriesInstanceUID}-${id}`}
                opticalPath={opticalPath}
                metadata={images}
                isVisible={this.props.visibleOpticalPathIdentifiers.has(id)}
                defaultStyle={this.props.defaultOpticalPathStyles[id]}
                onVisibilityChange={this.props.onOpticalPathVisibilityChange}
                onStyleChange={this.props.onOpticalPathStyleChange}
                onRemoval={this.handleItemRemoval}
                isRemovable={isSelectable}
                hasIccProfile={this.props.hasIccProfiles}
              />,
            )
          } else {
            const title =
              description !== '' ? `${id} - ${description}` : `${id}`
            optionItems.push({ id, title })
          }
        }
      })
    })

    let opticalPathSelector: React.ReactNode
    if (isSelectable && optionItems.length > 0) {
      opticalPathSelector = (
        <div className="flex gap-1.5">
          <Select
            value={this.state.selectedOpticalPathIdentifier ?? ''}
            onValueChange={this.handleItemSelectionChange}
          >
            <SelectTrigger className="min-w-0 flex-1">
              <SelectValue placeholder="Add optical path" />
            </SelectTrigger>
            <SelectContent>
              {optionItems.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            title="Add optical path"
            aria-label="Add optical path"
            disabled={this.state.selectedOpticalPathIdentifier === undefined}
            onClick={this.handleItemAddition}
          >
            <Icon name="add" size={18} />
          </Button>
        </div>
      )
    }

    const { displaySettings, onDisplaySettingsChange } = this.props

    return (
      <div className="flex flex-col gap-1.5">
        {opticalPathItems}
        {opticalPathSelector}
        {displaySettings !== undefined &&
          onDisplaySettingsChange !== undefined && (
            <DisplayOptionsPanel
              className="mt-2"
              options={bindDisplayOptions(
                buildOpticalPathDisplayOptions({
                  ...displaySettings,
                  hasIccProfiles: this.props.hasIccProfiles,
                }),
                (id, enabled) => {
                  if (id === 'icc') {
                    onDisplaySettingsChange({
                      ...displaySettings,
                      iccProfileEnabled: enabled,
                    })
                  } else if (id === 'gamma') {
                    onDisplaySettingsChange({
                      ...displaySettings,
                      gammaEnabled: enabled,
                    })
                  }
                },
              )}
            />
          )}
      </div>
    )
  }
}

export default OpticalPathList
