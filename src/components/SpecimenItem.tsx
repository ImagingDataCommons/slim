/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { memo, useMemo } from 'react'

import { toKeyValueItems } from '../utils/keyValue'
import { buildSpecimenAttributes } from '../utils/specimen'
import Description from './Description'

export interface SpecimenItemProps {
  specimen: dmv.metadata.SpecimenDescription
  showStain: boolean
}

/**
 * One DICOM Specimen Description: identifier plus specimen-related attributes
 * of a DICOM Slide Microscopy image.
 */
function SpecimenItem({
  specimen,
  showStain,
}: SpecimenItemProps): React.ReactElement {
  const items = useMemo(
    () => toKeyValueItems(buildSpecimenAttributes(specimen, { showStain })),
    [specimen, showStain],
  )
  return <Description header={specimen.SpecimenIdentifier} items={items} />
}

export default memo(SpecimenItem)
