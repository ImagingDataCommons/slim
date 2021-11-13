import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import SegmentItem from './SegmentItem'

interface SegmentListProps {
  segments: dmv.segment.Segment[]
  visibleSegmentUIDs: string[]
  onSegmentVisibilityChange: ({ segmentUID, isVisible }: {
    segmentUID: string
    isVisible: boolean
  }) => void
  onSegmentStyleChange: ({ segmentUID, styleOptions }: {
    segmentUID: string,
    styleOptions: {
      opacity: number
    }
  }) => void
}

/**
 * React component representing a list of Segments.
 */
class SegmentList extends React.Component<SegmentListProps, {}> {
  render (): React.ReactNode {
    const items = this.props.segments.map((segment, index) => (
      <SegmentItem
        key={segment.uid}
        segment={segment}
        index={index}
        isVisible={this.props.visibleSegmentUIDs.includes(segment.uid)}
        onVisibilityChange={this.props.onSegmentVisibilityChange}
        onStyleChange={this.props.onSegmentStyleChange}
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
