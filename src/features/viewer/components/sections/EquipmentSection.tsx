import type React from 'react'

import Equipment from '../../../../components/Equipment'
import { SlimCollapsibleSection } from '../../../../components/slim/SlimCollapsibleSection'

export type EquipmentSectionProps = React.ComponentProps<typeof Equipment>

/** Acquisition equipment of the slide. */
export function EquipmentSection({
  metadata,
}: EquipmentSectionProps): React.ReactElement {
  return (
    <SlimCollapsibleSection
      title="Equipment"
      defaultOpen={false}
      padding="indent"
    >
      <Equipment metadata={metadata} />
    </SlimCollapsibleSection>
  )
}
