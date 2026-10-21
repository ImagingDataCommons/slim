/**
 * Cards keep ARIA table roles so the worklist stays one table for AT.
 */
/** biome-ignore-all lint/a11y/useSemanticElements: intentional ARIA table on divs for CSS cards */
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type * as React from 'react'
import { Link } from 'react-router'

import { MonoChip } from '../../../components/ui/mono-chip'
import { Skeleton } from '../../../components/ui/skeleton'
import { cn } from '../../../lib/utils'
import { buildStudyPath } from '../../../utils/routes'
import { DASH } from '../utils/studyFields'
import { buildWorklistCardFields } from '../utils/worklistCard'

export interface WorklistCardProps {
  study: dmv.metadata.Study
  hiddenColumnIds: readonly string[]
  isCompact: boolean
  onOpen: (study: dmv.metadata.Study) => void
  marker?: React.ReactNode
}

/** Stacked study row used when the worklist grid cannot fit five columns. */
export function WorklistCard({
  study,
  hiddenColumnIds,
  isCompact,
  onOpen,
  marker,
}: WorklistCardProps): React.ReactElement {
  const fields = buildWorklistCardFields(study, hiddenColumnIds)
  const details = [fields.patientId, fields.studyDate, fields.accession].filter(
    (part) => part !== undefined && part !== DASH,
  )

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={() => onOpen(study)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(study)
        }
      }}
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-2.5 border-b border-line-soft px-4 text-ink-body transition-colors focus-within:bg-selected hover:bg-selected',
        isCompact ? 'py-2' : 'py-2.5',
      )}
    >
      {marker !== undefined && (
        <div className="flex h-5 w-5 flex-none items-center justify-center pt-0.5">
          {marker}
        </div>
      )}
      <div role="cell" className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <Link
            to={buildStudyPath(study.StudyInstanceUID)}
            onClick={(event) => event.stopPropagation()}
            className="min-w-0 flex-1 truncate rounded-sm text-[15px] font-semibold text-ink hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {fields.patientName}
          </Link>
          {fields.series !== undefined && (
            <span className="flex-none text-12.5 font-semibold text-ink-secondary">
              {fields.series} series
            </span>
          )}
        </div>
        {details.length > 0 && (
          <div className="truncate font-mono text-12.5 text-ink-muted">
            {details.join(' · ')}
          </div>
        )}
        {fields.modalities.length > 0 && (
          <span className="flex flex-wrap content-center gap-1">
            {fields.modalities.map((modality) => (
              <MonoChip key={modality}>{modality}</MonoChip>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}

export interface WorklistCardSkeletonProps {
  isCompact: boolean
  delayMs?: number
}

/** Stacked placeholder that matches the card field layout. */
export function WorklistCardSkeleton({
  isCompact,
  delayMs = 0,
}: WorklistCardSkeletonProps): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'min-h-11 border-b border-line-soft px-4',
        isCompact ? 'py-2' : 'py-2.5',
      )}
    >
      <div className="flex flex-col gap-1.5">
        <Skeleton
          className="h-3.5 w-2/3"
          style={{ animationDelay: `${delayMs}ms` }}
        />
        <Skeleton
          className="h-2.5 w-1/2"
          style={{ animationDelay: `${delayMs + 40}ms` }}
        />
        <Skeleton
          className="h-5 w-14"
          style={{ animationDelay: `${delayMs + 80}ms` }}
        />
      </div>
    </div>
  )
}
