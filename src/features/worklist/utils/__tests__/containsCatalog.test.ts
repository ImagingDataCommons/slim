import { StorageClasses } from '../../../../data/uids'
import {
  CONTAINS_CATALOG,
  findContainsEntry,
  matchContainsEntries,
} from '../containsCatalog'

const ids = (entries: { id: string }[]): string[] =>
  entries.map((entry) => entry.id)

describe('containsCatalog', () => {
  it('has unique ids', () => {
    const all = ids([...CONTAINS_CATALOG])
    expect(new Set(all).size).toBe(all.length)
  })

  it('only skips confirmation when the modality belongs to one entry', () => {
    for (const entry of CONTAINS_CATALOG) {
      const sharing = CONTAINS_CATALOG.filter(
        (other) => other.modality === entry.modality,
      )
      expect(entry.needsConfirmation).toBe(
        sharing.length > 1 || entry.modality === 'OT',
      )
    }
  })

  it('finds entries by id', () => {
    expect(findContainsEntry('pmap')?.label).toBe('Parametric map')
    expect(findContainsEntry('nope')).toBeUndefined()
    expect(findContainsEntry(null)).toBeUndefined()
    expect(findContainsEntry('')).toBeUndefined()
  })
})

describe('matchContainsEntries', () => {
  it('returns every entry for an empty query', () => {
    expect(matchContainsEntries('  ')).toHaveLength(CONTAINS_CATALOG.length)
  })

  it('matches labels and aliases case-insensitively', () => {
    expect(ids(matchContainsEntries('PARAMETRIC'))).toEqual(['pmap'])
    expect(ids(matchContainsEntries('heatmap'))).toEqual(['pmap'])
    expect(ids(matchContainsEntries('mbsa'))).toEqual(['ann'])
  })

  it('matches the modality and the group', () => {
    expect(ids(matchContainsEntries('seg'))).toEqual(['seg', 'labelmap'])
    expect(ids(matchContainsEntries('presentation'))).toEqual([
      'pr-blending',
      'pr-color',
      'pr-pseudocolor',
      'pr-grayscale',
    ])
  })

  it('matches a pasted SOP Class UID exactly', () => {
    expect(
      ids(matchContainsEntries(` ${StorageClasses.COMPREHENSIVE_3D_SR} `)),
    ).toEqual(['sr3d'])
  })

  it('returns nothing for unrelated text', () => {
    expect(matchContainsEntries('ultrasound')).toEqual([])
  })
})
