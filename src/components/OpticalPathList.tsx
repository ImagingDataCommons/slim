/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { useMemo, useState } from 'react'

import type {
  OpticalPathStyle,
  OpticalPathStyleChange,
} from '../types/layerStyles'
import { buildOpticalPathDisplayOptions } from '../utils/displayOptions'
import { bindDisplayOptions } from '../utils/displayOptionsBinding'
import { partitionOpticalPaths } from '../utils/opticalPathPartition'
import OpticalPathItem from './OpticalPathItem'
import { DisplayOptionsPanel } from './slim/DisplayOptionsPanel'
import { Button } from './ui/button'
import { Icon } from './ui/icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

export interface OpticalPathDisplaySettings {
  iccProfileEnabled: boolean
  gammaEnabled: boolean
}

export interface OpticalPathListProps {
  opticalPaths: dmv.opticalPath.OpticalPath[]
  metadata?: {
    [opticalPathIdentifier: string]: dmv.metadata.VLWholeSlideMicroscopyImage[]
  }
  visibleOpticalPathIdentifiers: Set<string>
  activeOpticalPathIdentifiers: Set<string>
  defaultOpticalPathStyles: {
    [opticalPathIdentifier: string]: OpticalPathStyle
  }
  onOpticalPathVisibilityChange: (change: {
    opticalPathIdentifier: string
    isVisible: boolean
  }) => void
  onOpticalPathStyleChange: (change: {
    opticalPathIdentifier: string
    styleOptions: OpticalPathStyleChange
  }) => void
  onOpticalPathActivityChange: (change: {
    opticalPathIdentifier: string
    isActive: boolean
  }) => void
  /** @deprecated Not used; styles are followed through `defaultOpticalPathStyles` */
  selectedPresentationStateUID?: string
  /** Display settings for ICC profiles and gamma correction */
  displaySettings?: OpticalPathDisplaySettings
  /** Callback when display settings change */
  onDisplaySettingsChange?: (settings: OpticalPathDisplaySettings) => void
  /** Whether ICC profiles are available for this slide */
  hasIccProfiles?: boolean
}

/** Active optical paths plus a selector to add inactive ones. */
function OpticalPathList({
  opticalPaths,
  metadata,
  visibleOpticalPathIdentifiers,
  activeOpticalPathIdentifiers,
  defaultOpticalPathStyles,
  onOpticalPathVisibilityChange,
  onOpticalPathStyleChange,
  onOpticalPathActivityChange,
  displaySettings,
  onDisplaySettingsChange,
  hasIccProfiles,
}: OpticalPathListProps): React.ReactElement | null {
  const [selectedIdentifier, setSelectedIdentifier] = useState<
    string | undefined
  >(undefined)
  const { active, available } = useMemo(
    () =>
      partitionOpticalPaths(
        opticalPaths,
        metadata ?? {},
        activeOpticalPathIdentifiers,
      ),
    [opticalPaths, metadata, activeOpticalPathIdentifiers],
  )

  if (metadata === undefined) {
    return null
  }

  const isSelectable = opticalPaths.length > 1
  const handleRemoval = (opticalPathIdentifier: string): void => {
    onOpticalPathActivityChange({ opticalPathIdentifier, isActive: false })
  }
  const handleAddition = (): void => {
    if (selectedIdentifier === undefined) return
    onOpticalPathActivityChange({
      opticalPathIdentifier: selectedIdentifier,
      isActive: true,
    })
    setSelectedIdentifier(undefined)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {active.map(({ key, opticalPath, images }) => (
        <OpticalPathItem
          key={key}
          opticalPath={opticalPath}
          metadata={images}
          isVisible={visibleOpticalPathIdentifiers.has(opticalPath.identifier)}
          defaultStyle={defaultOpticalPathStyles[opticalPath.identifier]}
          onVisibilityChange={onOpticalPathVisibilityChange}
          onStyleChange={onOpticalPathStyleChange}
          onRemoval={handleRemoval}
          isRemovable={isSelectable}
          hasIccProfile={hasIccProfiles}
        />
      ))}
      {isSelectable && available.length > 0 && (
        <div className="flex gap-1.5">
          <Select
            value={selectedIdentifier ?? ''}
            onValueChange={setSelectedIdentifier}
          >
            <SelectTrigger
              className="min-w-0 flex-1"
              aria-label="Optical path to add"
            >
              <SelectValue placeholder="Add optical path" />
            </SelectTrigger>
            <SelectContent>
              {available.map((option) => (
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
            disabled={selectedIdentifier === undefined}
            onClick={handleAddition}
          >
            <Icon name="add" size={18} />
          </Button>
        </div>
      )}
      {displaySettings !== undefined &&
        onDisplaySettingsChange !== undefined && (
          <DisplayOptionsPanel
            options={bindDisplayOptions(
              buildOpticalPathDisplayOptions({
                ...displaySettings,
                hasIccProfiles,
              }),
              displaySettings,
              { icc: 'iccProfileEnabled', gamma: 'gammaEnabled' },
              onDisplaySettingsChange,
            )}
          />
        )}
    </div>
  )
}

export default OpticalPathList
