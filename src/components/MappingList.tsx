import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import MappingItem from './MappingItem'

interface MappingListProps {
  mappings: dmv.mapping.Mapping[]
  metadata: {
    [mappingUID: string]: dmv.metadata.ParametricMap[]
  }
  visibleMappingUIDs: string[]
  defaultMappingStyles: {
    [mappingUID: string]: {
      opacity: number
      limitValues: number[]
    }
  }
  onMappingVisibilityChange: ({ mappingUID, isVisible }: {
    mappingUID: string
    isVisible: boolean
  }) => void
  onMappingStyleChange: ({ mappingUID, styleOptions }: {
    mappingUID: string,
    styleOptions: {
      opacity?: number
      limitValues?: number[]
    }
  }) => void
}

/**
 * React component representing a list of Real World Value Mappings.
 */
class MappingList extends React.Component<MappingListProps, {}> {
  render (): React.ReactNode {
    const items = this.props.mappings.map((mapping, index) => {
      const uid = mapping.uid
      return (
        <MappingItem
          key={mapping.uid}
          mapping={mapping}
          metadata={this.props.metadata[uid]}
          isVisible={this.props.visibleMappingUIDs.includes(uid)}
          defaultStyle={this.props.defaultMappingStyles[uid]}
          onVisibilityChange={this.props.onMappingVisibilityChange}
          onStyleChange={this.props.onMappingStyleChange}
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

export default MappingList
