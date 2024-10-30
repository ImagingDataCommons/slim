import dcmjs from 'dcmjs'

const { DicomMetaDictionary } = dcmjs.data
// @ts-expect-error
const { nameMap } = DicomMetaDictionary

interface TagInfo {
  tag: string
  vr: string
  keyword: string
  value: string
  children?: TagInfo[]
  level: number
}

export interface DicomTag {
  name: string;
  vr: string;
  Value?: any[];
  [key: string]: any;
}

export const formatTagValue = (tag: DicomTag): string => {
  if (!tag.Value) return '';
  
  if (Array.isArray(tag.Value)) {
    return tag.Value.join(', ');
  }
  
  return String(tag.Value);
};

/**
 * Processes DICOM metadata and returns a flattened array of tag information
 * @param metadata - The DICOM metadata object to process
 * @param depth - The current depth level for nested sequences (default: 0)
 * @returns Array of processed tag information
 */
export function getRows (metadata: Record<string, any>, depth = 0): TagInfo[] {
  const keywords = Object.keys(metadata).filter(key => key !== '_vrMap')

  return keywords.flatMap(keyword => {
    const tagInfo = nameMap[keyword]
    let value = metadata[keyword]

    // Handle private or unknown tags
    if (tagInfo === undefined) {
      const regex = /[0-9A-Fa-f]{6}/g
      if (keyword.match(regex) == null) return []

      return [{
        tag: `(${keyword.substring(0, 4)},${keyword.substring(4, 8)})`,
        vr: '',
        keyword: 'Private Tag',
        value: value?.toString() ?? '',
        level: depth
      }]
    }

    // Handle sequence values (SQ VR)
    if (tagInfo.vr === 'SQ' && value !== undefined) {
      const sequenceItems = Array.isArray(value) ? value : [value]
      const children = sequenceItems.flatMap((item, index) => {
        // Process each item in the sequence
        const itemTags = getRows(item, depth + 1)
        return itemTags
      })

      return [{
        tag: tagInfo.tag,
        vr: tagInfo.vr,
        keyword,
        value: `Sequence with ${sequenceItems.length} item(s)`,
        level: depth,
        children: children
      }]
    }

    // Handle array values
    if (Array.isArray(value)) {
      value = value.join('\\')
    }

    return [{
      tag: tagInfo.tag,
      vr: tagInfo.vr,
      keyword: keyword.replace('RETIRED_', ''),
      value: value?.toString() ?? '',
      level: depth
    }]
  })
}

/**
 * Sorts DICOM tags alphabetically by tag value
 * @param metadata - The DICOM metadata object to process
 * @returns Sorted array of tag information
 */
export function getSortedTags (metadata: Record<string, any>): TagInfo[] {
  const tagList = getRows(metadata)
  return tagList.sort((a, b) => a.tag.localeCompare(b.tag))
}
