import type React from 'react'

import AnnotationList from '../../../../components/AnnotationList'
import { SlimCollapsibleSection } from '../../../../components/slim/SlimCollapsibleSection'

export type AnnotationsSectionProps = React.ComponentProps<
  typeof AnnotationList
> & {
  enableAnnotationTools: boolean
}

/** ROIs of the slide; shown empty only when the user can draw. */
export function AnnotationsSection({
  enableAnnotationTools,
  ...listProps
}: AnnotationsSectionProps): React.ReactElement | null {
  const { rois } = listProps
  if (rois.length === 0 && !enableAnnotationTools) return null
  return (
    <SlimCollapsibleSection
      title="Annotations"
      count={rois.length}
      countTone="primary"
      padding="none"
      contentClassName="px-2 pb-3 pt-0.5"
    >
      {rois.length > 0 ? (
        <AnnotationList {...listProps} />
      ) : (
        <p className="px-2 py-1 text-12 text-ink-muted">
          No ROIs yet. Use Draw to annotate the slide.
        </p>
      )}
    </SlimCollapsibleSection>
  )
}
