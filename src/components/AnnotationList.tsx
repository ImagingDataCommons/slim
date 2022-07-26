import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu, Switch } from 'antd'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

import AnnotationItem from './AnnotationItem'

interface AnnotationListProps {
  rois: dmv.roi.ROI[]
  selectedRoiUIDs: Set<string>
  visibleRoiUIDs: Set<string>
  onVisibilityChange: ({ roiUID, isVisible }: {
    roiUID: string
    isVisible: boolean
  }) => void
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
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
  }

  handleVisibilityChange (
    checked: boolean,
    event: React.MouseEvent<HTMLButtonElement>
  ): void {
    if (checked) {
      this.props.rois.forEach(roi => {
        this.props.onVisibilityChange({ roiUID: roi.uid, isVisible: checked })
      })
    } else {
      this.props.visibleRoiUIDs.forEach(roiUID => {
        this.props.onVisibilityChange({ roiUID, isVisible: checked })
      })
    }
  }

  handleMenuItemSelection (object: any): void {
    this.props.onSelection({ roiUID: object.key })
  }

  render (): React.ReactNode {
    const items = this.props.rois.map((roi, index) => (
      <AnnotationItem
        key={roi.uid}
        roi={roi}
        index={index}
        isVisible={this.props.visibleRoiUIDs.has(roi.uid)}
        onVisibilityChange={this.props.onVisibilityChange}
      />
    ))

    return (
      <>
        <div style={{ paddingLeft: '14px', paddingTop: '7px', paddingBottom: '7px' }}>
          <Switch
            size='small'
            onChange={this.handleVisibilityChange}
            checked={this.props.visibleRoiUIDs.size > 0}
            checkedChildren={<FaEye />}
            unCheckedChildren={<FaEyeSlash />}
          />
        </div>
        <Menu
          selectedKeys={[...this.props.selectedRoiUIDs.values()]}
          onSelect={this.handleMenuItemSelection}
          onClick={this.handleMenuItemSelection}
        >
          {items}
        </Menu>
      </>
    )
  }
}

export default AnnotationList
