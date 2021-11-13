import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import MappingItem from './MappingItem'

interface MappingListProps {
  mappings: dmv.mapping.Mapping[]
  visibleMappingUIDs: string[]
  onMappingVisibilityChange: ({ mappingUID, isVisible }: {
    mappingUID: string
    isVisible: boolean
  }) => void
  onMappingStyleChange: ({ mappingUID, styleOptions }: {
    mappingUID: string,
    styleOptions: {
      opacity: number
    }
  }) => void
}

/**
 * React component representing a list of Real World Value Mappings.
 */
class MappingList extends React.Component<MappingListProps, {}> {
  render (): React.ReactNode {
    const items = this.props.mappings.map((mapping, index) => (
      <MappingItem
        key={mapping.uid}
        mapping={mapping}
        index={index}
        isVisible={this.props.visibleMappingUIDs.includes(mapping.uid)}
        onVisibilityChange={this.props.onMappingVisibilityChange}
        onStyleChange={this.props.onMappingStyleChange}
      />
    ))

    return (
      <Menu selectable={false}>
        {items}
      </Menu>
    )
  }
}

export default MappingList
