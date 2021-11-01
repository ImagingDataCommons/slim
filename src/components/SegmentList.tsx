import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import SegmentItem from './SegmentItem'

interface SegmentListProps {
  segments: dmv.segment.Segment[]
  visibleSegmentUIDs: string[]
  onVisibilityChange: ({ segmentUID }: {
    segmentUID: string
  }) => void
  onOpacityChange: ({ segmentUID, value }: {
    segmentUID: string,
    value: number
  }) => void
}

/**
 * React component representing a list of Region of Interest (ROI)
 * annotations.
 */
class SegmentList extends React.Component<SegmentListProps, {}> {
  render (): React.ReactNode {
    const items = this.props.segments.map((segment, index) => (
      <SegmentItem
        key={segment.uid}
        segment={segment}
        index={index}
        styleOptions={{ opacity: 0.5 }}
        isVisible={this.props.visibleSegmentUIDs.includes(segment.uid)}
        onVisibilityChange={this.props.onVisibilityChange}
        onOpacityChange={this.props.onOpacityChange}
      />
    ))

    return (
      <Menu selectable={false}>
        {items}
      </Menu>
    )
  }
}

export default SegmentList
