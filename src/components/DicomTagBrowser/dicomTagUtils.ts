// @ts-nocheck
import dcmjs from 'dcmjs';

const { DicomMetaDictionary } = dcmjs.data;
const { nameMap } = DicomMetaDictionary;

interface TagInfo {
  tag: string;
  tagIndent: string;
  vr: string;
  keyword: string;
  value: string;
}

/**
 * Processes DICOM metadata and returns a flattened array of tag information
 * @param metadata - The DICOM metadata object to process
 * @param depth - The current depth level for nested sequences (default: 0)
 * @returns Array of processed tag information
 */
export function getRows(metadata: Record<string, any>, depth = 0): TagInfo[] {
  const keywords = Object.keys(metadata).filter(key => key !== '_vrMap');
  const tagIndent = '>'.repeat(depth) + (depth > 0 ? ' ' : '');

  return keywords.flatMap(keyword => {
    const tagInfo = nameMap[keyword];
    let value = metadata[keyword];

    // Handle private or unknown tags
    if (!tagInfo) {
      const regex = /[0-9A-Fa-f]{6}/g;
      if (!keyword.match(regex)) return [];
      
      return [{
        tag: `(${keyword.substring(0, 4)},${keyword.substring(4, 8)})`,
        tagIndent,
        vr: '',
        keyword: 'Private Tag',
        value: value?.toString() || '',
      }];
    }

    // Handle sequence values (SQ VR)
    if (tagInfo.vr === 'SQ' && value) {
      const sequenceItems = Array.isArray(value) ? value : [value];
      return sequenceItems.flatMap((item, index) => {
        const subRows = getRows(item, depth + 1);
        return [
          {
            tag: tagInfo.tag,
            tagIndent,
            vr: tagInfo.vr,
            keyword,
            value: `Sequence Item #${index + 1}`,
          },
          ...subRows,
        ];
      });
    }

    // Handle array values
    if (Array.isArray(value)) {
      value = value.join('\\');
    }

    return [{
      tag: tagInfo.tag,
      tagIndent,
      vr: tagInfo.vr,
      keyword: keyword.replace('RETIRED_', ''),
      value: value?.toString() || '',
    }];
  });
}

/**
 * Sorts DICOM tags alphabetically by tag value
 * @param metadata - The DICOM metadata object to process
 * @returns Sorted array of tag information
 */
export function getSortedTags(metadata: Record<string, any>): TagInfo[] {
  const tagList = getRows(metadata);
  return tagList.sort((a, b) => a.tag.localeCompare(b.tag));
} 