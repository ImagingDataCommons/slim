import type React from 'react'

import OpticalPathList from '../../../../components/OpticalPathList'
import { SlimCollapsibleSection } from '../../../../components/slim/SlimCollapsibleSection'

export type OpticalPathsSectionProps = React.ComponentProps<
  typeof OpticalPathList
>

/** Channels of the slide with their visibility, activity and style. */
export function OpticalPathsSection(
  props: OpticalPathsSectionProps,
): React.ReactElement {
  return (
    <SlimCollapsibleSection
      title="Optical paths"
      count={props.opticalPaths.length}
    >
      <OpticalPathList {...props} />
    </SlimCollapsibleSection>
  )
}
