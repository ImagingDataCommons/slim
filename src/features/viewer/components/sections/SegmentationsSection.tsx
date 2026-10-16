import type React from 'react'

import SegmentList from '../../../../components/SegmentList'
import type { SeriesOption } from '../../utils/groupBySeries'
import { SeriesFilteredSection } from './SeriesFilteredSection'

export type SegmentationsSectionProps = React.ComponentProps<
  typeof SegmentList
> & {
  seriesOptions: readonly SeriesOption[]
  selectedSeriesUID: string
  onSeriesChange: (seriesUID: string) => void
}

/** Segments of the selected segmentation series. */
export function SegmentationsSection({
  seriesOptions,
  selectedSeriesUID,
  onSeriesChange,
  ...listProps
}: SegmentationsSectionProps): React.ReactElement {
  return (
    <SeriesFilteredSection
      title="Segmentations"
      seriesOptions={seriesOptions}
      selectedSeriesUID={selectedSeriesUID}
      onSeriesChange={onSeriesChange}
    >
      <SegmentList {...listProps} />
    </SeriesFilteredSection>
  )
}
