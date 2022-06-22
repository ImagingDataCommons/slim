import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import SegmentItem from './SegmentItem'

interface SegmentListProps {
  segments: dmv.segment.Segment[]
  visibleSegmentUIDs: Set<string>
  metadata: {
    [segmentUID: string]: dmv.metadata.Segmentation[]
  }
  defaultSegmentStyles: {
    [segmentUID: string]: {
      opacity: number
    }
  }
  onSegmentVisibilityChange: ({ segmentUID, isVisible }: {
    segmentUID: string
    isVisible: boolean
  }) => void
  onSegmentStyleChange: ({ segmentUID, styleOptions }: {
    segmentUID: string
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
    const items = this.props.segments.map((segment, index) => {
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
        />
      )
    })

    return (
      <Menu selectable={false}>
        {items}
      </Menu>
    )
  }
}

export default SegmentList
