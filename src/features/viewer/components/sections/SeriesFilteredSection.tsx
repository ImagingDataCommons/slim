import type React from 'react'

import { SlimCollapsibleSection } from '../../../../components/slim/SlimCollapsibleSection'
import type { SeriesOption } from '../../utils/groupBySeries'
import { SeriesSelect } from '../OptionSelect'

export interface SeriesFilteredSectionProps {
  title: string
  defaultOpen?: boolean
  seriesOptions: readonly SeriesOption[]
  selectedSeriesUID: string
  onSeriesChange: (seriesUID: string) => void
  children: React.ReactNode
}

/** Collapsible panel section with a series filter above its list. */
export function SeriesFilteredSection({
  title,
  defaultOpen,
  seriesOptions,
  selectedSeriesUID,
  onSeriesChange,
  children,
}: SeriesFilteredSectionProps): React.ReactElement {
  return (
    <SlimCollapsibleSection title={title} defaultOpen={defaultOpen}>
      <SeriesSelect
        value={selectedSeriesUID}
        options={seriesOptions}
        onValueChange={onSeriesChange}
      />
      {children}
    </SlimCollapsibleSection>
  )
}
