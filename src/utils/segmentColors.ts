/**
 * Utility functions for handling segment colors
 */

import dcmjs from 'dcmjs'

/**
 * Type guard to check if a value is defined and not null
 */
const isDefined = <T>(value: T | undefined | null): value is T => {
  return value !== undefined && value !== null
}

/**
 * Generate a distinct color for a segment based on its index
 * Uses a predefined palette of distinct colors that work well together
 */
export const generateSegmentColor = (index: number): number[] => {
  // Use a predefined palette of distinct colors that work well together
  const colorPalette = [
    [255, 0, 0], // Red
    [0, 255, 0], // Green
    [0, 0, 255], // Blue
    [255, 255, 0], // Yellow
    [255, 0, 255], // Magenta
    [0, 255, 255], // Cyan
    [255, 128, 0], // Orange
    [128, 0, 255], // Purple
    [0, 128, 128], // Teal
    [128, 128, 0], // Olive
    [255, 128, 128], // Light Red
    [128, 255, 128], // Light Green
    [128, 128, 255], // Light Blue
    [255, 255, 128], // Light Yellow
    [255, 128, 255], // Light Magenta
    [128, 255, 255] // Light Cyan
  ]

  return colorPalette[index % colorPalette.length]
}

/**
 * Convert RGB values to hex color string
 */
export const rgbToHex = (rgb: number[]): string => {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0])))
  const g = Math.max(0, Math.min(255, Math.round(rgb[1])))
  const b = Math.max(0, Math.min(255, Math.round(rgb[2])))
  return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/**
 * Convert hex color string to RGB values
 */
export const hexToRgb = (hex: string): number[] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result !== null) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ]
  }
  return [0, 0, 0]
}

/**
 * Check if a color is light or dark for determining text contrast
 */
export const isLightColor = (rgb: number[]): boolean => {
  const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
  return brightness > 128
}

/**
 * Get contrasting text color (black or white) for a given background color
 */
export const getContrastColor = (rgb: number[]): number[] => {
  return isLightColor(rgb) ? [0, 0, 0] : [255, 255, 255]
}

/**
 * Extract color hints from DICOM segment metadata
 * Looks for RecommendedDisplayCIELabValue in the Segment Sequence
 */
export const extractSegmentColorFromMetadata = (
  segmentMetadata: Record<string, unknown>,
  segmentNumber: number
): number[] | null => {
  try {
    /** Look for SegmentSequence in the metadata */
    if (segmentMetadata.SegmentSequence !== undefined && Array.isArray(segmentMetadata.SegmentSequence)) {
      const segment = (segmentMetadata.SegmentSequence as Array<Record<string, unknown>>).find(
        (seg: Record<string, unknown>) => seg.SegmentNumber === segmentNumber
      )

      if (isDefined(segment) && isDefined(segment.RecommendedDisplayCIELabValue) && Array.isArray(segment.RecommendedDisplayCIELabValue)) {
        /** Convert CIELab to RGB using dcmjs */
        const labValues = segment.RecommendedDisplayCIELabValue as number[]
        if (labValues.length >= 3) {
          try {
            /** Use dcmjs's dicomlab2RGB function for accurate DICOM CIELAB to RGB conversion */
            const rgb = dcmjs.data.Colors.dicomlab2RGB(labValues)
            /** Convert from 0-1 range to 0-255 range and round to integers */
            const result = [
              Math.max(0, Math.min(255, Math.round(rgb[0] * 255))),
              Math.max(0, Math.min(255, Math.round(rgb[1] * 255))),
              Math.max(0, Math.min(255, Math.round(rgb[2] * 255)))
            ]
            return result
          } catch (error) {
            /** Failed to convert CIELab to RGB using dcmjs */
            console.warn('Failed to convert CIELab to RGB using dcmjs:', error)
            return null
          }
        }
      }
    }
  } catch (error) {
    /** Failed to extract color from segment metadata */
    console.warn(`Failed to extract color from segment ${segmentNumber}:`, error)
  }

  return null
}

/**
 * Get the best color for a segment, either from DICOM metadata or generated
 */
export const getSegmentColor = (
  segmentMetadata: Record<string, unknown>,
  segmentNumber: number,
  fallbackIndex: number
): number[] => {
  /** First try to get color from DICOM metadata */
  const metadataColor = extractSegmentColorFromMetadata(segmentMetadata, segmentNumber)
  if (metadataColor !== null) {
    return metadataColor
  }

  /** Fall back to generated color */
  return generateSegmentColor(fallbackIndex)
}

/**
 * Get segmentation type from metadata
 * Returns the SegmentationType from DICOM metadata or defaults to 'BINARY'
 */
export const getSegmentationType = (
  segmentMetadata: Record<string, unknown> | undefined | null
): string => {
  if (segmentMetadata?.SegmentationType !== undefined && segmentMetadata?.SegmentationType !== null) {
    return segmentMetadata.SegmentationType as string
  }
  return 'BINARY'
}
