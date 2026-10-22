import type React from 'react'

import type DicomWebManager from '../DicomWebManager'
import type { Slide } from '../data/slides'
import SlideItem from './SlideItem'

export interface SlideListProps {
  metadata: Slide[]
  clients: { [key: string]: DicomWebManager }
  selectedSeriesInstanceUID: string
  onSeriesSelection: ({
    seriesInstanceUID,
  }: {
    seriesInstanceUID: string
  }) => void
}

/** Slide cards of a study; the selected slide follows the route's series. */
function SlideList({
  metadata,
  clients,
  selectedSeriesInstanceUID,
  onSeriesSelection,
}: SlideListProps): React.ReactElement {
  return (
    <ul
      aria-label="Slides"
      className="m-0 flex list-none flex-col gap-2 px-3 pb-4"
    >
      {metadata.map((slide) => {
        const seriesInstanceUID = slide.seriesInstanceUIDs[0]
        return (
          <li key={seriesInstanceUID}>
            <SlideItem
              slide={slide}
              clients={clients}
              isSelected={slide.seriesInstanceUIDs.includes(
                selectedSeriesInstanceUID,
              )}
              onSelect={onSeriesSelection}
            />
          </li>
        )
      })}
    </ul>
  )
}

export default SlideList
