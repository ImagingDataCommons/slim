import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { List } from 'antd'

import SpecimenItem from './SpecimenItem'

interface SpecimenListProps {
  metadata?: dmv.metadata.VLWholeSlideMicroscopyImage
  showstain: boolean
}

/**
 * React component representing a list of DICOM Specimen Information Entities.
 */
class SpecimenList extends React.Component<SpecimenListProps, {}> {
  render (): React.ReactNode {
    if (this.props.metadata === undefined) {
      return null
    }
    const items = this.props.metadata.SpecimenDescriptionSequence.map(
      (item: dmv.metadata.SpecimenDescription, index: number) => {
        return (
          <SpecimenItem
            index={index}
            key={item.SpecimenUID}
            metadata={this.props.metadata}
            showstain={this.props.showstain}
          />
        )
      }
    )
    return (
      <List style={{ overflowY: 'auto' }}>
        {items}
      </List>
    )
  }
}

export default SpecimenList
