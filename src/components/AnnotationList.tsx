import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import AnnotationItem from './AnnotationItem'

interface AnnotationListProps {
  rois: dmv.roi.ROI[]
  selectedRoiUIDs: string[]
  visibleRoiUIDs: string[]
  onToggleVisibility: ({ roiUID }: { roiUID: string }) => void
  onSelection: ({ roiUID }: { roiUID: string }) => void
}

/**
 * React component representing a list of Region of Interest (ROI)
 * annotations.
 */
class AnnotationList extends React.Component<AnnotationListProps, {}> {
  constructor (props: AnnotationListProps) {
    super(props)
    this.handleMenuItemSelection = this.handleMenuItemSelection.bind(this)
  }


  
  handleMenuItemSelection (
    object: any
  ): void {
    this.props.onSelection({ roiUID: object.key })
  }

  render (): React.ReactNode {
    const items = this.props.rois.map((roi, index) => (
      <AnnotationItem
        key={roi.uid}
        roi={roi}
        index={index}
        isVisible={this.props.visibleRoiUIDs.includes(roi.uid)}
        onToggleVisibility={this.props.onToggleVisibility}
      />
    ))

    return (
      <Menu
        selectedKeys={this.props.selectedRoiUIDs}
        onSelect={this.handleMenuItemSelection}
        onClick={this.handleMenuItemSelection}
      >
        {items}
      </Menu>
    )
  }
}

export default AnnotationList
