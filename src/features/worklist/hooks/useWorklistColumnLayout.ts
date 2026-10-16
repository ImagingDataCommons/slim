import { useEffect, useState } from 'react'

import {
  sanitizeHiddenColumnIds,
  WORKLIST_COLUMN_IDS,
  WORKLIST_LOCKED_COLUMN_ID,
  type WorklistColumnId,
} from '../utils/worklistColumns'

/**
 * How wide the worklist panel is, for column shedding. Tiers are chosen by
 * whether each set's minimum column widths fit the measured panel.
 */
export type WorklistWidthTier = 'base' | 'md' | 'lg' | 'xl'

/** Horizontal padding on each grid row (`px-5` × 2). */
const ROW_PAD_X = 40

/** Row gap used when summing fit (`sm:gap-3`). */
const ROW_GAP = 12

/**
 * Slack so tracks aren't flush to the clip edge. Kept modest so a typical
 * laptop width (~1400px content) still reaches the full column set.
 */
const FIT_MARGIN = 56

/**
 * Minimum readable width per column. Used only to pick a tier; the live grid
 * still uses flexible `fr` tracks so columns share leftover space.
 */
const COLUMN_MIN_WIDTH: Record<WorklistColumnId, number> = {
  PatientName: 150,
  PatientID: 120,
  PatientBirthDate: 92,
  PatientSex: 52,
  ModalitiesInStudy: 110,
  StudyDate: 108,
  StudyTime: 52,
  AccessionNumber: 120,
  StudyID: 120,
  ReferringPhysicianName: 130,
  Slides: 56,
}

/** `fr` weight per column when building a dynamic grid template. */
const COLUMN_FR: Record<WorklistColumnId, number> = {
  PatientName: 1.6,
  PatientID: 1.2,
  PatientBirthDate: 0.85,
  PatientSex: 0.5,
  ModalitiesInStudy: 1.3,
  StudyDate: 1,
  StudyTime: 0.5,
  AccessionNumber: 1.1,
  StudyID: 1.05,
  ReferringPhysicianName: 0.95,
  Slides: 0.5,
}

/**
 * Eligible columns per tier, in DOM/grid order. Primary set always includes
 * Slides so the count never falls off the right edge.
 */
export const WORKLIST_COLUMNS_BY_TIER: Record<
  WorklistWidthTier,
  WorklistColumnId[]
> = {
  base: [
    'PatientName',
    'PatientID',
    'ModalitiesInStudy',
    'StudyDate',
    'Slides',
  ],
  md: [
    'PatientName',
    'PatientID',
    'PatientSex',
    'ModalitiesInStudy',
    'StudyDate',
    'AccessionNumber',
    'Slides',
  ],
  lg: [
    'PatientName',
    'PatientID',
    'PatientSex',
    'ModalitiesInStudy',
    'StudyDate',
    'AccessionNumber',
    'StudyID',
    'Slides',
  ],
  xl: [...WORKLIST_COLUMN_IDS],
}

const TIER_ORDER: WorklistWidthTier[] = ['xl', 'lg', 'md', 'base']

function minWidthForColumns(columnIds: readonly string[]): number {
  const gaps = Math.max(0, columnIds.length - 1) * ROW_GAP
  const cols = columnIds.reduce(
    (sum, id) => sum + (COLUMN_MIN_WIDTH[id as WorklistColumnId] ?? 80),
    0,
  )
  return ROW_PAD_X + cols + gaps + FIT_MARGIN
}

export function tierForWidth(width: number): WorklistWidthTier {
  for (const tier of TIER_ORDER) {
    if (width >= minWidthForColumns(WORKLIST_COLUMNS_BY_TIER[tier])) {
      return tier
    }
  }
  return 'base'
}

/**
 * Columns shown for a tier after applying the user's hidden set. PatientName
 * always remains. Order matches DOM/grid packing.
 */
export function resolveVisibleColumnIds(
  tier: WorklistWidthTier,
  hiddenColumnIds: readonly string[] = [],
): WorklistColumnId[] {
  const hidden = new Set(sanitizeHiddenColumnIds(hiddenColumnIds))
  return WORKLIST_COLUMNS_BY_TIER[tier].filter(
    (id) => id === WORKLIST_LOCKED_COLUMN_ID || !hidden.has(id),
  )
}

/**
 * TanStack visibility map: every known column is explicit so hiding a
 * primary-tier column (e.g. PatientID) works, not only secondary ones.
 */
export function resolveWorklistVisibility(
  tier: WorklistWidthTier,
  hiddenColumnIds: readonly string[] = [],
): Record<string, boolean> {
  const visible = new Set(resolveVisibleColumnIds(tier, hiddenColumnIds))
  const visibility: Record<string, boolean> = {}
  for (const id of WORKLIST_COLUMN_IDS) {
    visibility[id] = visible.has(id)
  }
  return visibility
}

/** CSS `grid-template-columns` for the given visible column ids. */
export function gridTemplateForColumns(
  columnIds: readonly WorklistColumnId[],
): string {
  if (columnIds.length === 0) return 'minmax(0, 1fr)'
  return columnIds.map((id) => `minmax(0, ${COLUMN_FR[id]}fr)`).join(' ')
}

/** @deprecated Prefer {@link resolveWorklistVisibility}; kept for older tests. */
export function columnVisibilityForTier(
  tier: WorklistWidthTier,
): Record<string, boolean> {
  return resolveWorklistVisibility(tier, [])
}

/**
 * Observes `element`'s width and returns the worklist column tier. Falls back
 * to `base` until the element is mounted.
 */
export function useWorklistColumnLayout(
  element: HTMLElement | null,
): WorklistWidthTier {
  const [tier, setTier] = useState<WorklistWidthTier>('base')

  useEffect(() => {
    if (element === null) return
    const update = (width: number): void => {
      setTier(tierForWidth(width))
    }
    update(element.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width !== undefined) update(width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return tier
}
