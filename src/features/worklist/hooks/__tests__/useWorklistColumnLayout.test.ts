import { describe, expect, it } from 'vitest'

import {
  columnVisibilityForTier,
  gridTemplateForColumns,
  resolveVisibleColumnIds,
  resolveWorklistVisibility,
  tierForWidth,
  WORKLIST_COLUMNS_BY_TIER,
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

describe('resolveVisibleColumnIds', () => {
  it('keeps PatientName even when asked to hide it', () => {
    expect(
      resolveVisibleColumnIds('md', ['PatientName', 'AccessionNumber']),
    ).toEqual([
      'PatientName',
      'PatientID',
      'PatientSex',
      'ModalitiesInStudy',
      'StudyDate',
      'Slides',
    ])
  })

  it('ignores unknown ids and still respects the tier cap', () => {
    expect(
      resolveVisibleColumnIds('base', ['PatientSex', 'nope', 'StudyID']),
    ).toEqual([
      'PatientName',
      'PatientID',
      'ModalitiesInStudy',
      'StudyDate',
      'Slides',
    ])
  })
})

describe('resolveWorklistVisibility', () => {
  it('hides a primary column when the user turns it off', () => {
    const visibility = resolveWorklistVisibility('xl', ['PatientID'])
    expect(visibility.PatientName).toBe(true)
    expect(visibility.PatientID).toBe(false)
    expect(visibility.Slides).toBe(true)
  })
})

describe('gridTemplateForColumns', () => {
  it('emits one track per visible column', () => {
    const ids = resolveVisibleColumnIds('md', ['AccessionNumber'])
    const tracks = gridTemplateForColumns(ids)
      .split(/\s+/)
      .filter((part) => part.startsWith('minmax')).length
    expect(tracks).toBe(ids.length)
  })
})

describe('WORKLIST_COLUMNS_BY_TIER', () => {
  it('always ends with slides', () => {
    for (const tier of ['base', 'md', 'lg', 'xl'] as const) {
      expect(WORKLIST_COLUMNS_BY_TIER[tier].at(-1)).toBe('Slides')
    }
  })
})
