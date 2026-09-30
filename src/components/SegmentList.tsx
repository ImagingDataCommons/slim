/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import SegmentItem from './SegmentItem'
import { type DisplayOption, DisplayOptionsPanel } from './slim'

interface SegmentDisplaySettings {
  clusteringEnabled: boolean
  interpolationEnabled: boolean
  clusteringThreshold: string
}

interface SegmentListProps {
  segments: dmv.segment.Segment[]
  visibleSegmentUIDs: Set<string>
  metadata: {
    [segmentUID: string]: dmv.metadata.Segmentation[]
  }
  defaultSegmentStyles: {
    [segmentUID: string]: {
      opacity: number
      color?: number[]
    }
  }
  onSegmentVisibilityChange: ({
    segmentUID,
    isVisible,
  }: {
    segmentUID: string
    isVisible: boolean
  }) => void
  onSegmentStyleChange: ({
    segmentUID,
    styleOptions,
  }: {
    segmentUID: string
    styleOptions: {
      opacity: number
      color?: number[]
    }
  }) => void
  onSegmentClick: (segmentUID: string) => void
  /** Display settings for clustering and interpolation */
  displaySettings?: SegmentDisplaySettings
  /** Callback when display settings change */
  onDisplaySettingsChange?: (settings: SegmentDisplaySettings) => void
}

/**
 * React component representing a list of Segments.
 */
class SegmentList extends React.Component<
  SegmentListProps,
  Record<string, never>
> {
  render(): React.ReactNode {
    const items = this.props.segments.map((segment, _index) => {
      const uid = segment.uid
      return (
        <SegmentItem
          key={segment.uid}
          segment={segment}
          metadata={this.props.metadata[uid]}
          isVisible={this.props.visibleSegmentUIDs.has(uid)}
          defaultStyle={this.props.defaultSegmentStyles[uid]}
          onVisibilityChange={this.props.onSegmentVisibilityChange}
          onStyleChange={this.props.onSegmentStyleChange}
          onClick={this.props.onSegmentClick}
        />
      )
    })

    /** Display options for clustering and interpolation */
    const { displaySettings, onDisplaySettingsChange } = this.props
    const displayOptions: DisplayOption[] = []

    if (
      displaySettings !== undefined &&
      onDisplaySettingsChange !== undefined
    ) {
      displayOptions.push({
        id: 'clustering',
        label: 'Clustering',
        description: 'Group dense segments at low zoom.',
        enabled: displaySettings.clusteringEnabled,
        onChange: (enabled) => {
          onDisplaySettingsChange({
            ...displaySettings,
            clusteringEnabled: enabled,
          })
        },
      })

      displayOptions.push({
        id: 'interpolation',
        label: 'Segment interpolation',
        shortLabel: 'Interp.',
        description: 'Smooth segment edges when zoomed in.',
        enabled: displaySettings.interpolationEnabled,
        onChange: (enabled) => {
          onDisplaySettingsChange({
            ...displaySettings,
            interpolationEnabled: enabled,
          })
        },
      })
    }

    /** Additional input for clustering threshold */
    const clusteringThresholdInput =
      displaySettings !== undefined && onDisplaySettingsChange !== undefined
        ? {
            label: 'Clustering pixel size threshold',
            description:
              'At or below this pixel size, clustering turns off. Leave empty for zoom-based detection.',
            value: displaySettings.clusteringThreshold,
            placeholder: 'Auto (zoom-based)',
            unit: 'mm',
            onChange: (value: string) => {
              onDisplaySettingsChange({
                ...displaySettings,
                clusteringThreshold: value,
              })
            },
          }
        : undefined

    return (
      <div className="flex flex-col gap-1.5">
        {items}
        {displayOptions.length > 0 && (
          <DisplayOptionsPanel
            options={displayOptions}
            additionalInput={clusteringThresholdInput}
          />
        )}
      </div>
    )
  }
}

export default SegmentList
