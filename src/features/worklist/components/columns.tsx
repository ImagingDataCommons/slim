import type { ColumnDef } from '@tanstack/react-table'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'

import { Icon } from '../../../components/ui/icon'
import {
  formatDisplayDate,
  formatDisplayTime,
  formatPersonName,
  formatSex,
} from '../../../utils/displayFormat'
import {
  DASH,
  getNumberOfSlides,
  normalizeModalities,
  orDash,
} from '../utils/studyFields'

/** Grid template shared by the header row and the study rows. */
export const WORKLIST_GRID_COLUMNS =
  'grid-cols-[1.6fr_1fr_1fr_.9fr_.6fr_1fr_.8fr_1.1fr_1fr_1.2fr_.7fr]'

type PersonNameValue = Parameters<typeof formatPersonName>[0]

export interface WorklistColumnMeta {
  align?: 'right'
}

/** Column definitions (sorting accessors + cells) for the worklist grid. */
export const columns: Array<ColumnDef<dmv.metadata.Study>> = [
  {
    id: 'PatientName',
    header: 'Patient name',
    accessorFn: (study) =>
      formatPersonName(study.PatientName as PersonNameValue),
    cell: ({ getValue }) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-md border border-line bg-app text-ink-faint">
          <Icon name="biotech" size={16} />
        </span>
        <span className="truncate font-semibold text-ink">
          {orDash(getValue<string>())}
        </span>
      </div>
    ),
  },
  {
    id: 'PatientID',
    header: 'Patient ID',
    accessorFn: (study) => study.PatientID ?? '',
    cell: ({ getValue }) => (
      <span className="block truncate font-mono text-[12.5px]">
        {orDash(getValue<string>())}
      </span>
    ),
  },
  {
    id: 'PatientBirthDate',
    header: 'Birth date',
    accessorFn: (study) => study.PatientBirthDate ?? '',
    cell: ({ getValue }) => orDash(formatDisplayDate(getValue<string>())),
  },
  {
    id: 'PatientSex',
    header: 'Sex',
    accessorFn: (study) => study.PatientSex ?? '',
    cell: ({ getValue }) => orDash(formatSex(getValue<string>())),
  },
  {
    id: 'ModalitiesInStudy',
    header: 'Modality',
    enableSorting: false,
    accessorFn: (study) => normalizeModalities(study.ModalitiesInStudy),
    cell: ({ getValue }) => {
      const modalities = getValue<string[]>()
      if (modalities.length === 0) return DASH
      return (
        <span className="flex flex-wrap gap-1">
          {modalities.map((modality) => (
            <span
              key={modality}
              className="rounded bg-chip px-1.5 py-[3px] font-mono text-[11px] font-semibold leading-none text-chip-foreground"
            >
              {modality}
            </span>
          ))}
        </span>
      )
    },
  },
  {
    id: 'StudyDate',
    header: 'Study date',
    accessorFn: (study) => study.StudyDate ?? '',
    cell: ({ getValue }) => orDash(formatDisplayDate(getValue<string>())),
  },
  {
    id: 'StudyTime',
    header: 'Time',
    accessorFn: (study) => study.StudyTime ?? '',
    cell: ({ getValue }) => (
      <span className="text-ink-muted">
        {orDash(formatDisplayTime(getValue<string>()))}
      </span>
    ),
  },
  {
    id: 'AccessionNumber',
    header: 'Accession #',
    accessorFn: (study) => study.AccessionNumber ?? '',
    cell: ({ getValue }) => (
      <span className="block truncate font-mono text-[12.5px]">
        {orDash(getValue<string>())}
      </span>
    ),
  },
  {
    id: 'StudyID',
    header: 'Study ID',
    accessorFn: (study) => study.StudyID ?? '',
    cell: ({ getValue }) => (
      <span className="block truncate font-mono text-[12.5px]">
        {orDash(getValue<string>())}
      </span>
    ),
  },
  {
    id: 'ReferringPhysicianName',
    header: 'Referring physician',
    accessorFn: (study) =>
      formatPersonName(
        (study as unknown as { ReferringPhysicianName?: PersonNameValue })
          .ReferringPhysicianName,
      ),
    cell: ({ getValue }) => (
      <span className="block truncate">{orDash(getValue<string>())}</span>
    ),
  },
  {
    id: 'Slides',
    header: 'Slides',
    meta: { align: 'right' } as WorklistColumnMeta,
    accessorFn: (study) => getNumberOfSlides(study) ?? -1,
    cell: ({ getValue }) => {
      const count = getValue<number>()
      return (
        <span className="block text-right font-semibold">
          {count >= 0 ? count : DASH}
        </span>
      )
    },
  },
]
