import type React from 'react'

import { SlimKeyValueGrid } from '../../../components/slim/SlimKeyValueGrid'
import {
  DEFAULT_MEASUREMENT_GROUP,
  type RoiDescription as RoiDescriptionData,
} from '../utils/selectedRoiDescription'

export interface RoiDescriptionProps {
  description: RoiDescriptionData
}

const SECTION_TITLE_CLASS =
  'mb-2 border-b border-line-soft pb-1.5 text-11 font-semibold uppercase tracking-[0.06em] text-ink-secondary'

/** Body of the "Selected ROI" dialog. */
export function RoiDescription({
  description,
}: RoiDescriptionProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <SlimKeyValueGrid items={description.attributes} />
      <div>
        <div className={SECTION_TITLE_CLASS}>Spatial coordinates</div>
        <SlimKeyValueGrid items={description.scoord} />
      </div>
      <div>
        <div className={SECTION_TITLE_CLASS}>Evaluations</div>
        <SlimKeyValueGrid items={description.evaluations} />
      </div>
      <div>
        <div className={SECTION_TITLE_CLASS}>Measurements</div>
        {description.measurementGroups.map(({ identifier, items }) =>
          identifier === DEFAULT_MEASUREMENT_GROUP ? (
            <SlimKeyValueGrid key={identifier} items={items} />
          ) : (
            <div key={identifier} className="mt-2">
              <div className="mb-1.5 font-mono text-11 text-ink-muted">
                {identifier}
              </div>
              <SlimKeyValueGrid items={items} />
            </div>
          ),
        )}
      </div>
    </div>
  )
}
