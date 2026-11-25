/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import SpecimenItem from './SpecimenItem'

export interface SpecimenListProps {
  metadata?: dmv.metadata.VLWholeSlideMicroscopyImage
  /** List staining steps among the preparation attributes */
  showStain?: boolean
}

/** List of the DICOM Specimen Information Entities of a slide image. */
function SpecimenList({
  metadata,
  showStain = true,
}: SpecimenListProps): React.ReactElement | null {
  if (metadata === undefined) {
    return null
  }
  /**
   * Specimen Description Sequence is a type 1 attribute. However, it is
   * nevertheless missing in some data sets. This is a violation of the
   * standard, but it may be better to facilitate display of the data.
   */
  const descriptions = metadata.SpecimenDescriptionSequence ?? []
  return (
    <div className="flex flex-col gap-1.5">
      {descriptions.map((specimen) => (
        <SpecimenItem
          key={specimen.SpecimenUID}
          specimen={specimen}
          showStain={showStain}
        />
      ))}
    </div>
  )
}

export default SpecimenList
