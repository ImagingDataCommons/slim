import { useEffect, useState } from 'react'

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
const COLUMN_MIN_WIDTH: Record<string, number> = {
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

/**
 * Visible columns per tier, in DOM/grid order. Primary set always includes
 * Slides so the count never falls off the right edge.
 */
export const WORKLIST_COLUMNS_BY_TIER: Record<WorklistWidthTier, string[]> = {
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
  xl: [
    'PatientName',
    'PatientID',
    'PatientBirthDate',
    'PatientSex',
    'ModalitiesInStudy',
    'StudyDate',
    'StudyTime',
    'AccessionNumber',
    'StudyID',
    'ReferringPhysicianName',
    'Slides',
  ],
}

const TIER_ORDER: WorklistWidthTier[] = ['xl', 'lg', 'md', 'base']

function minWidthForColumns(columnIds: readonly string[]): number {
  const gaps = Math.max(0, columnIds.length - 1) * ROW_GAP
  const cols = columnIds.reduce(
    (sum, id) => sum + (COLUMN_MIN_WIDTH[id] ?? 80),
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

/** CSS `grid-template-columns` value for a tier (applied via style, not Tailwind). */
export const WORKLIST_GRID_TEMPLATE_BY_TIER: Record<WorklistWidthTier, string> =
  {
    base: 'minmax(0, 1.8fr) minmax(0, 1.3fr) minmax(0, 1.4fr) minmax(0, 1.1fr) minmax(0, 0.55fr)',
    md: 'minmax(0, 1.6fr) minmax(0, 1.2fr) minmax(0, 0.5fr) minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 0.5fr)',
    lg: 'minmax(0, 1.5fr) minmax(0, 1.15fr) minmax(0, 0.45fr) minmax(0, 1.3fr) minmax(0, 0.95fr) minmax(0, 1fr) minmax(0, 1.05fr) minmax(0, 0.45fr)',
    xl: 'minmax(0, 1.4fr) minmax(0, 1.05fr) minmax(0, 0.85fr) minmax(0, 0.4fr) minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 0.5fr) minmax(0, 0.95fr) minmax(0, 0.9fr) minmax(0, 0.95fr) minmax(0, 0.4fr)',
  }

/** TanStack visibility map for a tier (false = hidden). */
export function columnVisibilityForTier(
  tier: WorklistWidthTier,
): Record<string, boolean> {
  const visible = new Set(WORKLIST_COLUMNS_BY_TIER[tier])
  return {
    PatientBirthDate: visible.has('PatientBirthDate'),
    PatientSex: visible.has('PatientSex'),
    StudyTime: visible.has('StudyTime'),
    AccessionNumber: visible.has('AccessionNumber'),
    StudyID: visible.has('StudyID'),
    ReferringPhysicianName: visible.has('ReferringPhysicianName'),
  }
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
