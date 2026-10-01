import type React from 'react'

import SegmentList from '../../../../components/SegmentList'
import { SlimCollapsibleSection } from '../../../../components/slim/SlimCollapsibleSection'
import type { SeriesOption } from '../../utils/groupBySeries'
import { SeriesSelect } from '../OptionSelect'

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
    <SlimCollapsibleSection title="Segmentations">
      <SeriesSelect
        value={selectedSeriesUID}
        options={seriesOptions}
        onValueChange={onSeriesChange}
      />
      <SegmentList {...listProps} />
    </SlimCollapsibleSection>
  )
}
