import { StorageClasses } from '../../../data/uids'

/** URL search parameter holding the id of the active entry */
export const CONTAINS_PARAM = 'contains'

export type ContainsGroup =
  | 'Annotations'
  | 'Segmentations'
  | 'Maps'
  | 'Presentation states'

/** Derived data a study can be searched for, by SOP class */
export interface ContainsEntry {
  /** Stable key used in the `contains` URL parameter */
  id: string
  label: string
  group: ContainsGroup
  /** Extra search terms for the picker */
  aliases: readonly string[]
  sopClassUids: readonly string[]
  /**
   * Series modality to search when the server cannot match on SOP class.
   * Parametric map IODs do not fix a modality; IDC stores them as OT.
   */
  modality: string
  /** The modality is shared with other SOP classes, so matches must be checked */
  needsConfirmation: boolean
}

export const CONTAINS_GROUPS: readonly ContainsGroup[] = [
  'Annotations',
  'Segmentations',
  'Maps',
  'Presentation states',
]

export const CONTAINS_CATALOG: readonly ContainsEntry[] = [
  {
    id: 'ann',
    label: 'Bulk annotations',
    group: 'Annotations',
    aliases: ['microscopy bulk simple annotations', 'mbsa'],
    sopClassUids: [StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION],
    modality: 'ANN',
    needsConfirmation: false,
  },
  {
    id: 'sr3d',
    label: '3D SR annotations',
    group: 'Annotations',
    aliases: ['comprehensive 3d sr', 'tid 1500', 'measurements', 'roi'],
    sopClassUids: [StorageClasses.COMPREHENSIVE_3D_SR],
    modality: 'SR',
    needsConfirmation: true,
  },
  {
    id: 'sr',
    label: 'Comprehensive SR',
    group: 'Annotations',
    aliases: ['structured report'],
    sopClassUids: [StorageClasses.COMPREHENSIVE_SR],
    modality: 'SR',
    needsConfirmation: true,
  },
  {
    id: 'seg',
    label: 'Segmentation',
    group: 'Segmentations',
    aliases: ['mask'],
    sopClassUids: [StorageClasses.SEGMENTATION],
    modality: 'SEG',
    needsConfirmation: true,
  },
  {
    id: 'labelmap',
    label: 'Label map segmentation',
    group: 'Segmentations',
    aliases: ['labelmap', 'mask'],
    sopClassUids: [StorageClasses.LABELMAP_SEGMENTATION],
    modality: 'SEG',
    needsConfirmation: true,
  },
  {
    id: 'pmap',
    label: 'Parametric map',
    group: 'Maps',
    aliases: ['heatmap', 'heat map', 'score map', 'pm'],
    sopClassUids: [StorageClasses.PARAMETRIC_MAP],
    modality: 'OT',
    needsConfirmation: true,
  },
  {
    id: 'pr-blending',
    label: 'Advanced blending',
    group: 'Presentation states',
    aliases: ['presentation state', 'pr'],
    sopClassUids: [StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE],
    modality: 'PR',
    needsConfirmation: true,
  },
  {
    id: 'pr-color',
    label: 'Color',
    group: 'Presentation states',
    aliases: ['color softcopy presentation state', 'pr'],
    sopClassUids: [StorageClasses.COLOR_SOFTCOPY_PRESENTATION_STATE],
    modality: 'PR',
    needsConfirmation: true,
  },
  {
    id: 'pr-pseudocolor',
    label: 'Pseudocolor',
    group: 'Presentation states',
    aliases: ['pseudo-color softcopy presentation state', 'pr'],
    sopClassUids: [StorageClasses.PSEUDOCOLOR_SOFTCOPY_PRESENTATION_STATE],
    modality: 'PR',
    needsConfirmation: true,
  },
  {
    id: 'pr-grayscale',
    label: 'Grayscale',
    group: 'Presentation states',
    aliases: ['grayscale softcopy presentation state', 'pr'],
    sopClassUids: [StorageClasses.GRAYSCALE_SOFTCOPY_PRESENTATION_STATE],
    modality: 'PR',
    needsConfirmation: true,
  },
]

/** The catalog entry with this id, or undefined for unknown ids */
export function findContainsEntry(
  id: string | null | undefined,
): ContainsEntry | undefined {
  if (id == null || id === '') return undefined
  return CONTAINS_CATALOG.find((entry) => entry.id === id)
}

/**
 * Entries whose label, group, aliases or modality contain the query, or whose
 * SOP Class UID equals it. An empty query returns every entry.
 */
export function matchContainsEntries(
  query: string,
  catalog: readonly ContainsEntry[] = CONTAINS_CATALOG,
): ContainsEntry[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...catalog]
  return catalog.filter(
    (entry) =>
      entry.sopClassUids.includes(needle) ||
      [entry.label, entry.group, entry.modality, entry.id, ...entry.aliases]
        .map((term) => term.toLowerCase())
        .some((term) => term.includes(needle)),
  )
}
