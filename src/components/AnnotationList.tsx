import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import Annotation from './Annotation'

interface AnnotationListProps {
  rois: dmv.roi.ROI[]
  selectedRoiUID?: string
  onSelection: (
    { roiUID }: { roiUID: string }
  ) => void
}

/**
 * React component representing a list of Region of Interest (ROI) image
 * annotations.
 */
class AnnotationList extends React.Component<AnnotationListProps, {}> {
  render (): React.ReactNode {
    const items = this.props.rois.map((roi, index) => (
      <Annotation
        key={roi.uid}
        roi={roi}
        index={index}
      />
    ))
    const selectedItems = []
    if (this.props.selectedRoiUID !== undefined) {
      selectedItems.push(this.props.selectedRoiUID)
    }

    const handleMenuItemSelection = (
      object: any
    ): void => {
      this.setState(state => ({ selectedRoiUID: object.key }))
      this.props.onSelection({ roiUID: object.key })
    }

    return (
      <Menu
        selectedKeys={selectedItems}
        onSelect={handleMenuItemSelection}
        onClick={handleMenuItemSelection}
      >
        {items}
      </Menu>
    )
  }
}

export default AnnotationList
