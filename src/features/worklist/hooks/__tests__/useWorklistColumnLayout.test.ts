import { describe, expect, it } from 'vitest'

import {
  columnVisibilityForTier,
  tierForWidth,
  WORKLIST_COLUMNS_BY_TIER,
  WORKLIST_GRID_TEMPLATE_BY_TIER,
} from '../useWorklistColumnLayout'

describe('tierForWidth', () => {
  it('keeps the primary set at narrow widths', () => {
    expect(tierForWidth(500)).toBe('base')
    expect(columnVisibilityForTier('base').StudyID).toBe(false)
    expect(columnVisibilityForTier('base').PatientSex).toBe(false)
  })

  it('only adds Study ID when the panel is wide enough', () => {
    expect(tierForWidth(900)).toBe('md')
    expect(tierForWidth(1100)).toBe('lg')
    expect(columnVisibilityForTier('lg').StudyID).toBe(true)
    expect(columnVisibilityForTier('lg').ReferringPhysicianName).toBe(false)
  })

  it('shows the full set around a typical laptop width', () => {
    expect(tierForWidth(1400)).toBe('xl')
    expect(columnVisibilityForTier('xl').PatientBirthDate).toBe(true)
    expect(columnVisibilityForTier('xl').ReferringPhysicianName).toBe(true)
    expect(WORKLIST_COLUMNS_BY_TIER.xl).toEqual([
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
    ])
  })
})

describe('WORKLIST_COLUMNS_BY_TIER', () => {
  it('always ends with slides', () => {
    for (const tier of ['base', 'md', 'lg', 'xl'] as const) {
      const cols = WORKLIST_COLUMNS_BY_TIER[tier]
      expect(cols.at(-1)).toBe('Slides')
    }
  })

  it('matches grid track count to visible columns', () => {
    for (const tier of ['base', 'md', 'lg', 'xl'] as const) {
      const tracks = WORKLIST_GRID_TEMPLATE_BY_TIER[tier]
        .split(/\s+/)
        .filter((part) => part.startsWith('minmax')).length
      expect(tracks).toBe(WORKLIST_COLUMNS_BY_TIER[tier].length)
    }
  })
})
