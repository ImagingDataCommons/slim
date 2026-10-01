import type React from 'react'

import SpecimenList from '../../../../components/SpecimenList'
import { SlimCollapsibleSection } from '../../../../components/slim/SlimCollapsibleSection'

export interface SpecimensSectionProps {
  metadata: React.ComponentProps<typeof SpecimenList>['metadata']
}

/** Specimens described by the slide's base image. */
export function SpecimensSection({
  metadata,
}: SpecimensSectionProps): React.ReactElement {
  return (
    <SlimCollapsibleSection
      title="Specimens"
      count={metadata?.SpecimenDescriptionSequence?.length ?? 0}
    >
      <SpecimenList metadata={metadata} />
    </SlimCollapsibleSection>
  )
}
