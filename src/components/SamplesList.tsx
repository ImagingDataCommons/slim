import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import { Menu } from 'antd'

import SampleItem from './SampleItem'

interface SamplesListProps {
  metadata: dmv.metadata.VLWholeSlideMicroscopyImage[]
  viewer: dmv.viewer.VolumeImageViewer
}

/**
 * React component representing a list of DICOM Samples Information Entities.
 */
class SamplesList extends React.Component<SamplesListProps, {}> {
  render (): React.ReactNode {
    
    const opticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] = [] 
    this.props.metadata.forEach(
      (item: dmv.metadata.VLWholeSlideMicroscopyImage) => {
        if (item.OpticalPathSequence.length > 0) {
          const index = opticalPaths.findIndex(
            (property: dmv.metadata.VLWholeSlideMicroscopyImage) => {
              return property.OpticalPathSequence[0].OpticalPathIdentifier === 
                      item.OpticalPathSequence[0].OpticalPathIdentifier
            }
          )
          
          if (index === -1) {
            opticalPaths.push(item)
          }
        }
      }
    )

    /* To Do: filter the list for only the active Sample
    const filteredOpticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] =
      opticalPaths.filter((item: dmv.metadata.VLWholeSlideMicroscopyImage) => {
        return this.props.viewer.isOpticalPathActive(item.OpticalPathSequence[0].OpticalPathIdentifier)
      });*/
    
    const sortedOpticalPaths: dmv.metadata.VLWholeSlideMicroscopyImage[] = 
      opticalPaths.sort((n1: dmv.metadata.VLWholeSlideMicroscopyImage, 
                                 n2: dmv.metadata.VLWholeSlideMicroscopyImage) => {
        const id1 = parseInt(n1.OpticalPathSequence[0].OpticalPathIdentifier)
        const id2 = parseInt(n2.OpticalPathSequence[0].OpticalPathIdentifier)
        if ( id1 > id2) {
            return 1;
        }
  
        if (id1 < id2) {
            return -1;
        }
  
        return 0;
      });

    const items = sortedOpticalPaths.map(
      (item: dmv.metadata.VLWholeSlideMicroscopyImage) => {
        return (
          <SampleItem
            key={item.OpticalPathSequence[0].OpticalPathIdentifier}
            viewer={this.props.viewer}
            opticalPathSequence={item.OpticalPathSequence[0]}
            specimenDescriptionSequence={item.SpecimenDescriptionSequence[0]}
          />
        )
      }
    )

    return (
      <Menu selectable={false}>
        {items}
      </Menu>
      // To Do: add widgets to add/remove Sample
    )
  }
}

export default SamplesList
