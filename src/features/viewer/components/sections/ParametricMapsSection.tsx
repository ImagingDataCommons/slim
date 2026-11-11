import type React from 'react'

import MappingList from '../../../../components/MappingList'
import { SlimCollapsibleSection } from '../../../../components/slim/SlimCollapsibleSection'

export type ParametricMapsSectionProps = React.ComponentProps<
  typeof MappingList
>

/** Parameter mappings of the slide's parametric maps. */
export function ParametricMapsSection(
  props: ParametricMapsSectionProps,
): React.ReactElement | null {
  if (props.mappings.length === 0) return null
  return (
    <SlimCollapsibleSection
      title="Parametric maps"
      defaultOpen={false}
      divider={false}
    >
      <MappingList {...props} />
    </SlimCollapsibleSection>
  )
}
