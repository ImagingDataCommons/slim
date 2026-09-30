// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import {
  formatDisplayDate,
  formatDisplayTime,
  formatPersonName,
} from '../utils/displayFormat'
import { type KeyValueItem, SlimKeyValueGrid } from './slim/SlimKeyValueGrid'

interface StudyProps {
  metadata: dmv.metadata.Study | dmv.metadata.SOPClass
}

/** "12 Sep 2026, 09:42" from DICOM StudyDate/StudyTime. */
export function formatStudyDateTime(
  date: string | undefined,
  time: string | undefined,
): string {
  return [formatDisplayDate(date), formatDisplayTime(time)]
    .filter((part) => part !== '')
    .join(', ')
}

/**
 * Study information entity: common study-level attributes of the contained
 * slide microscopy images.
 */
function Study({ metadata }: StudyProps): React.ReactElement {
  const meta = metadata as unknown as Record<string, unknown>
  const description = meta.StudyDescription as string | undefined
  const items: KeyValueItem[] = [
    { label: 'Study ID', value: metadata.StudyID },
    { label: 'Accession #', value: metadata.AccessionNumber },
    {
      label: 'Date',
      value: formatStudyDateTime(metadata.StudyDate, metadata.StudyTime),
    },
    {
      label: 'Referring',
      value: formatPersonName(
        meta.ReferringPhysicianName as Parameters<typeof formatPersonName>[0],
      ),
    },
    ...(description !== undefined && description !== ''
      ? [{ label: 'Description', value: description }]
      : []),
  ]
  return <SlimKeyValueGrid items={items} />
}

export default Study
