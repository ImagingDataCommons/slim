import type React from 'react'

import AnnotationGroupList from '../../../../components/AnnotationGroupList'
import { SlimCollapsibleSection } from '../../../../components/slim/SlimCollapsibleSection'
import type { SeriesOption } from '../../utils/groupBySeries'
import { SeriesSelect } from '../OptionSelect'

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
    <SlimCollapsibleSection title="Annotation groups" defaultOpen={false}>
      <SeriesSelect
        value={selectedSeriesUID}
        options={seriesOptions}
        onValueChange={onSeriesChange}
      />
      <AnnotationGroupList {...listProps} />
    </SlimCollapsibleSection>
  )
}
