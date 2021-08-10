import React from 'react'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'

import Item from './Item'
import { Attribute } from './Description'

interface SpecimenItemProps {
  index: number
  metadata?: dmv.metadata.SOPClass
  showstain: boolean
}

/**
 * React component representing a DICOM Specimen Information Entity and
 * displays specimen-related attributes of a DICOM Slide Microscopy image.
 */
class SpecimenItem extends React.Component<SpecimenItemProps, {}> {
  render (): React.ReactNode {
    if (this.props.metadata === undefined) {
      return null
    }
    const specimenDescription = this.props.metadata.SpecimenDescriptionSequence[
      this.props.index
    ]
    const attributes: Attribute[] = []
    if ('SpecimenShortDescription' in specimenDescription) {
      attributes.push({
        name: 'Description',
        value: specimenDescription.SpecimenShortDescription
      })
    }
    if ('PrimaryAnatomicStructureSequence' in specimenDescription) {
      const structures = specimenDescription.PrimaryAnatomicStructureSequence
      attributes.push({
        name: 'Anatomic Structure',
        value: structures[0].CodeMeaning
      })
    }

    function doesCodeMatch (
      code: dcmjs.sr.coding.CodedConcept,
      scheme: string,
      value: string
    ): boolean {
      if (code.CodingSchemeDesignator === scheme && code.CodeValue === value) {
        return true
      }
      return false
    }

    // TID 8001 "Specimen Preparation"
    specimenDescription.SpecimenPreparationSequence.forEach(
      (step: dmv.metadata.SpecimenPreparation, index: number): void => {
        step.SpecimenPreparationStepContentItemSequence.forEach((
          item: (
            dcmjs.sr.valueTypes.CodeContentItem |
            dcmjs.sr.valueTypes.TextContentItem |
            dcmjs.sr.valueTypes.UIDRefContentItem |
            dcmjs.sr.valueTypes.PNameContentItem |
            dcmjs.sr.valueTypes.DateTimeContentItem
          ),
          index: number
        ) => {
          const name = item.ConceptNameCodeSequence[0]
          if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.CODE) {
            item = item as dcmjs.sr.valueTypes.CodeContentItem
            const value = item.ConceptCodeSequence[0]
            if (doesCodeMatch(name, 'DCM', '111701')) {
              // Processing Type
              const processingType = value.CodeMeaning
              console.debug(
                `parse specimen preparation step "${processingType}"`
              )
            } else {
              if (doesCodeMatch(name, 'SCT', '17636008')) {
                attributes.push({
                  name: 'Surgical collection',
                  value: value.CodeMeaning
                })
              } else if (doesCodeMatch(name, 'SCT', '430864009')) {
                attributes.push({
                  name: 'Fixative',
                  value: value.CodeMeaning
                })
              } else if (doesCodeMatch(name, 'SCT', '430863003')) {
                attributes.push({
                  name: 'Embedding medium',
                  value: value.CodeMeaning
                })
              } else if (doesCodeMatch(name, 'SCT', '424361007') && this.props.showstain) {
                attributes.push({
                  name: 'Stain',
                  value: value.CodeMeaning
                })
              }
            }
          } else if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.TEXT) {
            item = item as dcmjs.sr.valueTypes.TextContentItem
            if (doesCodeMatch(name, 'SCT', '424361007') && this.props.showstain) {
              attributes.push({
                name: 'Stain',
                value: item.TextValue
              })
            }
          } else {
            console.debug(`specimen preparation step #${index} not rendered`)
          }
        })
      }
    )
    const uid = specimenDescription.SpecimenUID
    const identifier = specimenDescription.SpecimenIdentifier
    return (
      <Item
        uid={uid}
        identifier={identifier}
        attributes={attributes}
        hasLongValues
      />
    )
  }
}

export default SpecimenItem
