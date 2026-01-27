import React from 'react'
// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import { Menu, Switch } from 'antd'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

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
}

/**
 * React component representing a list of Segments.
 */
class SegmentList extends React.Component<SegmentListProps, {}> {
  handleVisibilityChange = (checked: boolean): void => {
    if (checked) {
      this.props.segments.forEach((segment) => {
        this.props.onSegmentVisibilityChange({
          segmentUID: segment.uid,
          isVisible: checked,
        })
      })
      return
    }

    this.props.visibleSegmentUIDs.forEach((segmentUID) => {
      this.props.onSegmentVisibilityChange({
        segmentUID,
        isVisible: checked,
      })
    })
  }

  render(): React.ReactNode {
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
      <>
        <div
          style={{
            paddingLeft: '14px',
            paddingTop: '7px',
            paddingBottom: '7px',
          }}
        >
          <Switch
            size="small"
            onChange={this.handleVisibilityChange}
            checked={this.props.visibleSegmentUIDs.size > 0}
            checkedChildren={<FaEye />}
            unCheckedChildren={<FaEyeSlash />}
          />
        </div>
        <Menu selectable={false}>{items}</Menu>
      </>
    )
  }
}

export default SegmentList
