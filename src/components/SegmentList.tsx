import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import SegmentItem from './SegmentItem'

interface SegmentListProps {
  segments: dmv.segment.Segment[]
  visibleSegmentUIDs: string[]
  onChangeVisibility: ({ segmentUID }: { segmentUID: string }) => void
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
        isVisible={this.props.visibleSegmentUIDs.includes(segment.uid)}
        onChangeVisibility={this.props.onChangeVisibility}
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
