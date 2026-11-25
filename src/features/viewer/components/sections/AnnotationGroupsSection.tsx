import type React from 'react'

import AnnotationGroupList from '../../../../components/AnnotationGroupList'
import type { SeriesOption } from '../../utils/groupBySeries'
import { SeriesFilteredSection } from './SeriesFilteredSection'

export type AnnotationGroupsSectionProps = React.ComponentProps<
  typeof AnnotationGroupList
> & {
  seriesOptions: readonly SeriesOption[]
  selectedSeriesUID: string
  onSeriesChange: (seriesUID: string) => void
}

/** Bulk annotation groups of the selected annotation series. */
export function AnnotationGroupsSection({
  seriesOptions,
  selectedSeriesUID,
  onSeriesChange,
  ...listProps
}: AnnotationGroupsSectionProps): React.ReactElement {
  return (
    <SeriesFilteredSection
      title="Annotation groups"
      defaultOpen={false}
      seriesOptions={seriesOptions}
      selectedSeriesUID={selectedSeriesUID}
      onSeriesChange={onSeriesChange}
    >
      <AnnotationGroupList {...listProps} />
    </SeriesFilteredSection>
  )
}
