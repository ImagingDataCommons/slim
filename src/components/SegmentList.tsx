/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import {
  buildClusteringThresholdInput,
  buildSegmentDisplayOptions,
} from '../utils/displayOptions'
import SegmentItem from './SegmentItem'
import { BulkVisibilityControl } from './slim/BulkVisibilityControl'
import {
  bindDisplayOptions,
  DisplayOptionsPanel,
} from './slim/DisplayOptionsPanel'

export interface SegmentDisplaySettings {
  interpolationEnabled: boolean
  /** @deprecated Clustering belongs to AnnotationGroupList; listed only when set */
  clusteringEnabled?: boolean
  /** @deprecated Raw threshold text; the field is shown only when set */
  clusteringThreshold?: string
}

interface SegmentListProps<
  S extends SegmentDisplaySettings = SegmentDisplaySettings,
> {
  segments: dmv.segment.Segment[]
  visibleSegmentUIDs: Set<string>
  metadata: {
    [segmentUID: string]: dmv.metadata.Segmentation[]
  }
  defaultSegmentStyles: {
    [segmentUID: string]: {
      opacity: number
      color?: number[]
      /** Drives the FRACTIONAL swatch gradient when provided */
      paletteColorLookupTable?: { data: number[][] }
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
  /** Display settings; the callback receives the same shape that was passed */
  displaySettings?: S
  onDisplaySettingsChange?: (settings: S) => void
}

/**
 * React component representing a list of Segments.
 */
class SegmentList<
  S extends SegmentDisplaySettings = SegmentDisplaySettings,
> extends React.Component<SegmentListProps<S>, Record<string, never>> {
  private renderDisplayOptions(): React.ReactNode {
    const { displaySettings, onDisplaySettingsChange } = this.props
    if (
      displaySettings === undefined ||
      onDisplaySettingsChange === undefined
    ) {
      return null
    }
    const options = bindDisplayOptions(
      buildSegmentDisplayOptions(displaySettings),
      (id, enabled) => {
        if (id === 'clustering') {
          onDisplaySettingsChange({
            ...displaySettings,
            clusteringEnabled: enabled,
          })
        } else if (id === 'interpolation') {
          onDisplaySettingsChange({
            ...displaySettings,
            interpolationEnabled: enabled,
          })
        }
      },
    )
    const threshold = displaySettings.clusteringThreshold
    const additionalInput =
      threshold === undefined
        ? undefined
        : {
            ...buildClusteringThresholdInput(threshold),
            onInputChange: (value: string) =>
              onDisplaySettingsChange({
                ...displaySettings,
                clusteringThreshold: value,
              }),
          }
    return (
      <DisplayOptionsPanel
        options={options}
        additionalInput={additionalInput}
      />
    )
  }

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

    return (
      <div className="flex flex-col gap-1.5">
        <BulkVisibilityControl
          uids={this.props.segments.map((segment) => segment.uid)}
          visibleUids={this.props.visibleSegmentUIDs}
          onChange={({ uid, isVisible }) =>
            this.props.onSegmentVisibilityChange({
              segmentUID: uid,
              isVisible,
            })
          }
        />
        {items}
        {this.renderDisplayOptions()}
      </div>
    )
  }
}

export default SegmentList
