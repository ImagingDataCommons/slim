// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import {
  buildSpecimenAttributes,
  type SpecimenDescriptionLike,
} from '../utils/specimen'
import Item from './Item'

interface SpecimenItemProps {
  index: number
  metadata?: dmv.metadata.VLWholeSlideMicroscopyImage
  showstain: boolean
}

/**
 * React component representing a DICOM Specimen Information Entity and
 * displays specimen-related attributes of a DICOM Slide Microscopy image.
 */
class SpecimenItem extends React.Component<
  SpecimenItemProps,
  Record<string, never>
> {
  render(): React.ReactNode {
    if (this.props.metadata === undefined) {
      return null
    }

    const specimenDescription =
      this.props.metadata.SpecimenDescriptionSequence[this.props.index]

    if (specimenDescription === undefined) {
      return null
    }

    const description: SpecimenDescriptionLike = specimenDescription
    const attributes = buildSpecimenAttributes(description, {
      showStain: this.props.showstain,
    })

    return (
      <Item
        uid={specimenDescription.SpecimenUID}
        identifier={specimenDescription.SpecimenIdentifier}
        attributes={attributes}
      />
    )
  }
}

export default SpecimenItem
