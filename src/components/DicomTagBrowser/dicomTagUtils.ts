import dcmjs from 'dcmjs'

const { DicomMetaDictionary } = dcmjs.data

type DictionaryEntry = {
  tag: string
  vr: string
  name: string
}

type MetaDict = typeof DicomMetaDictionary & {
  dictionary: Record<string, DictionaryEntry>
  nameMap: Record<string, DictionaryEntry>
}

const metaDict = DicomMetaDictionary as MetaDict
const dictionary = metaDict.dictionary

export interface TagInfo {
  tag: string
  vr: string
  keyword: string
  value: string
  children?: TagInfo[]
  level: number
}

export interface DicomTag {
  name: string
  vr: string
  Value?: unknown[]
  [key: string]: unknown
}

const formatValue = (val: unknown): string => {
  if (typeof val === 'object' && val !== null) {
    return JSON.stringify(val)
  }
  return String(val)
}

export const formatTagValue = (tag: DicomTag): string => {
  if (tag.Value == null) return ''

  if (Array.isArray(tag.Value)) {
    return tag.Value.map(formatValue).join(', ')
  }

  return formatValue(tag.Value)
}

/** Normalize to "(GGGG,EEEE)" for dcmjs dictionary lookup. */
function punctuateTagId(keyword: string): string | null {
  const eightHex = /^[0-9A-Fa-f]{8}$/
  if (eightHex.test(keyword)) {
    const u = keyword.toUpperCase()
    return `(${u.slice(0, 4)},${u.slice(4)})`
  }
  const punct = /^\(([0-9A-Fa-f]{4}),([0-9A-Fa-f]{4})\)$/.exec(keyword)
  if (punct !== null) {
    return `(${punct[1].toUpperCase()},${punct[2].toUpperCase()})`
  }
  return null
}

/**
 * dicom-microscopy-viewer maps tags to keywords via its own table; newer tags
 * may remain numeric keys on the dataset. nameMap is keyword-keyed only, so we
 * also resolve by tag against the full dcmjs dictionary.
 */
function resolveDictionaryEntry(keyword: string): DictionaryEntry | undefined {
  const fromName = metaDict.nameMap[keyword] as DictionaryEntry | undefined
  if (fromName !== undefined) {
    return fromName
  }
  const punct = punctuateTagId(keyword)
  if (punct === null) {
    return undefined
  }
  return dictionary[punct]
}

function isSequenceItemArray(
  value: unknown,
): value is Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return false
  }
  return value.every(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      !(item instanceof Uint8Array) &&
      !(item instanceof Uint16Array) &&
      !(item instanceof Uint32Array) &&
      !(item instanceof Float32Array) &&
      !(item instanceof Float64Array),
  )
}

function vrFromVrMap(
  metadata: Record<string, unknown>,
  keyword: string,
): string {
  const map = metadata._vrMap
  if (map !== null && typeof map === 'object' && keyword in map) {
    return String((map as Record<string, string>)[keyword])
  }
  return ''
}

/**
 * Processes DICOM metadata and returns a flattened array of tag information
 * @param metadata - The DICOM metadata object to process
 * @param depth - The current depth level for nested sequences (default: 0)
 * @returns Array of processed tag information
 */
export function getRows(
  metadata: Record<string, unknown>,
  depth = 0,
): TagInfo[] {
  if (metadata === undefined || metadata === null) return []
  const keywords = Object.keys(metadata).filter((key) => key !== '_vrMap')

  return keywords.flatMap((keyword) => {
    const value = metadata[keyword]
    const entry = resolveDictionaryEntry(keyword)

    if (entry !== undefined) {
      const labelKeyword = entry.name.replace(/^RETIRED_/, '')

      if (entry.vr === 'SQ' && value !== undefined) {
        const sequenceItems = Array.isArray(value) ? value : [value]

        const sequenceNode: TagInfo = {
          tag: entry.tag,
          vr: entry.vr,
          keyword: labelKeyword,
          value: `Sequence with ${sequenceItems.length} item(s)`,
          level: depth,
          children: [],
        }

        sequenceNode.children = sequenceItems.map((item, index) => {
          const itemObj =
            item !== null && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : {}
          return {
            tag: `${entry.tag}.${index + 1}`,
            vr: 'Item',
            keyword: `Item ${index + 1}`,
            value: `Sequence Item ${index + 1}`,
            level: depth + 1,
            children: getRows(itemObj, depth + 2),
          }
        })

        return [sequenceNode]
      }

      let displayValue: unknown = value
      if (Array.isArray(displayValue)) {
        displayValue = displayValue.map(formatValue).join('\\')
      } else if (typeof displayValue === 'object' && displayValue !== null) {
        displayValue = formatValue(displayValue)
      }

      return [
        {
          tag: entry.tag,
          vr: entry.vr,
          keyword: labelKeyword,
          value: displayValue?.toString() ?? '',
          level: depth,
        },
      ]
    }

    const punct = punctuateTagId(keyword)
    const vrHint = vrFromVrMap(metadata, keyword)

    if (punct !== null) {
      if (isSequenceItemArray(value)) {
        const sequenceNode: TagInfo = {
          tag: punct,
          vr: vrHint !== '' ? vrHint : 'SQ',
          keyword: 'Unlisted sequence',
          value: `Sequence with ${value.length} item(s)`,
          level: depth,
          children: value.map((item, index) => ({
            tag: `${punct}.${index + 1}`,
            vr: 'Item',
            keyword: `Item ${index + 1}`,
            value: `Sequence Item ${index + 1}`,
            level: depth + 1,
            children: getRows(item, depth + 2),
          })),
        }
        return [sequenceNode]
      }

      let displayValue: unknown = value
      if (Array.isArray(displayValue)) {
        displayValue = displayValue.map(formatValue).join('\\')
      } else if (typeof displayValue === 'object' && displayValue !== null) {
        displayValue = formatValue(displayValue)
      }

      return [
        {
          tag: punct,
          vr: vrHint,
          keyword: 'Unlisted attribute',
          value: displayValue?.toString() ?? '',
          level: depth,
        },
      ]
    }

    return [
      {
        tag: keyword,
        vr: vrHint,
        keyword,
        value:
          value === null || value === undefined
            ? ''
            : typeof value === 'object'
              ? formatValue(value)
              : String(value),
        level: depth,
      },
    ]
  })
}

/**
 * Sorts DICOM tags alphabetically by tag value
 * @param metadata - The DICOM metadata object to process
 * @returns Sorted array of tag information
 */
export function getSortedTags(metadata: Record<string, unknown>): TagInfo[] {
  const tagList = getRows(metadata)

  // Add bulkdataReferences as a special tag if it exists
  if (
    metadata.bulkdataReferences !== undefined &&
    metadata.bulkdataReferences !== null
  ) {
    const bulkdataRefs = metadata.bulkdataReferences as Record<string, unknown>
    const bulkdataTag: TagInfo = {
      tag: 'bulkdataReferences',
      vr: 'OB',
      keyword: 'bulkdataReferences',
      value: `Object with ${Object.keys(bulkdataRefs).length} bulk data reference(s)`,
      level: 0,
      children: Object.keys(bulkdataRefs).map((key) => ({
        tag: `bulkdataReferences.${key}`,
        vr: 'OB',
        keyword: key,
        value: JSON.stringify(bulkdataRefs[key]),
        level: 1,
      })),
    }
    tagList.push(bulkdataTag)
  }

  return tagList.sort((a, b) => a.tag.localeCompare(b.tag))
}
