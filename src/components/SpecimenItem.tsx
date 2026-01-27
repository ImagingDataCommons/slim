// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import { SpecimenPreparationStepItems } from '../data/specimens'
import type { Attribute } from './Description'
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

    const attributes: Attribute[] = []

    if (specimenDescription.SpecimenShortDescription !== undefined) {
      attributes.push({
        name: 'Description',
        value: specimenDescription.SpecimenShortDescription,
      })
    }

    if (specimenDescription.PrimaryAnatomicStructureSequence !== undefined) {
      if (specimenDescription.PrimaryAnatomicStructureSequence.length > 0) {
        const structures = specimenDescription.PrimaryAnatomicStructureSequence
        attributes.push({
          name: 'Anatomical structure',
          value: structures.map((item) => item.CodeMeaning).join(', '),
        })
      }
    }

    const structures = specimenDescription.PrimaryAnatomicStructureSequence
    if (structures !== undefined && structures.length > 0) {
      const modifierSequence = structures.find(
        (s) =>
          (s as unknown as Record<string, unknown>)
            .PrimaryAnatomicStructureModifierSequence !== undefined,
      )
      if (modifierSequence != null) {
        const modifiers: dcmjs.sr.coding.CodedConcept[] = (
          modifierSequence as unknown as {
            PrimaryAnatomicStructureModifierSequence: dcmjs.sr.coding.CodedConcept[]
          }
        ).PrimaryAnatomicStructureModifierSequence
        if (modifiers.length > 0) {
          attributes.push({
            name: 'Primary Anatomic Structure Modifier',
            value: modifiers
              .map((item: dcmjs.sr.coding.CodedConcept) => item.CodeMeaning)
              .join(', '),
          })
        }
      }
    }

    // TID 8001 "Specimen Preparation"
    const preparationSteps: dmv.metadata.SpecimenPreparation[] =
      specimenDescription.SpecimenPreparationSequence ?? []

    preparationSteps.forEach(
      (step: dmv.metadata.SpecimenPreparation, _index: number): void => {
        step.SpecimenPreparationStepContentItemSequence.forEach(
          (
            item:
              | dcmjs.sr.valueTypes.CodeContentItem
              | dcmjs.sr.valueTypes.TextContentItem
              | dcmjs.sr.valueTypes.UIDRefContentItem
              | dcmjs.sr.valueTypes.PNameContentItem
              | dcmjs.sr.valueTypes.DateTimeContentItem,
            _index: number,
          ) => {
            const name = new dcmjs.sr.coding.CodedConcept({
              value: item.ConceptNameCodeSequence[0].CodeValue,
              schemeDesignator:
                item.ConceptNameCodeSequence[0].CodingSchemeDesignator,
              meaning: item.ConceptNameCodeSequence[0].CodeMeaning,
            })

            if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.CODE) {
              item = item as dcmjs.sr.valueTypes.CodeContentItem
              const value = new dcmjs.sr.coding.CodedConcept({
                value: item.ConceptCodeSequence[0].CodeValue,
                schemeDesignator:
                  item.ConceptCodeSequence[0].CodingSchemeDesignator,
                meaning: item.ConceptCodeSequence[0].CodeMeaning,
              })

              if (!name.equals(SpecimenPreparationStepItems.PROCESSING_TYPE)) {
                if (
                  name.equals(SpecimenPreparationStepItems.COLLECTION_METHOD)
                ) {
                  attributes.push({
                    name: 'Collection method',
                    value: value.CodeMeaning,
                  })
                } else if (name.equals(SpecimenPreparationStepItems.FIXATIVE)) {
                  attributes.push({
                    name: 'Tissue fixative',
                    value: value.CodeMeaning,
                  })
                } else if (
                  name.equals(SpecimenPreparationStepItems.EMBEDDING_MEDIUM)
                ) {
                  attributes.push({
                    name: 'Tissue embedding medium',
                    value: value.CodeMeaning,
                  })
                } else if (
                  name.equals(SpecimenPreparationStepItems.STAIN) &&
                  this.props.showstain
                ) {
                  attributes.push({
                    name: 'Tissue stain',
                    value: value.CodeMeaning,
                  })
                }
              }
            } else if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.TEXT) {
              item = item as dcmjs.sr.valueTypes.TextContentItem
              if (
                name.equals(SpecimenPreparationStepItems.STAIN) &&
                this.props.showstain
              ) {
                attributes.push({
                  name: 'Tissue stain',
                  value: item.TextValue,
                })
              } else if (
                name.equals(
                  SpecimenPreparationStepItems.PARENT_SPECIMEN_IDENTIFIER,
                )
              ) {
                attributes.push({
                  name: 'Parent specimen',
                  value: item.TextValue,
                })
              }
            }
          },
        )
      },
    )

    if (
      (this.props.metadata as unknown as Record<string, unknown>)
        .AdmittingDiagnosesDescription !== undefined
    ) {
      attributes.push({
        name: 'Admitting Diagnoses',
        value: (this.props.metadata as unknown as Record<string, unknown>)
          .AdmittingDiagnosesDescription as string,
      })
    }

    const uid = specimenDescription.SpecimenUID
    const identifier = specimenDescription.SpecimenIdentifier

    return (
      <Item
        uid={uid}
        key={uid}
        identifier={identifier}
        attributes={attributes}
        hasLongValues
      />
    )
  }
}

export default SpecimenItem
