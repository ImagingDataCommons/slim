/**
 * Utility functions for handling segment colors
 */

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
  return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)
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
 * Create a palette color lookup table for a segment
 * This can be used with the dicom-microscopy-viewer's setSegmentStyle method
 */
export const createSegmentPaletteColorLookupTable = (
  segmentUID: string,
  color: number[]
): any => {
  // Create a simple 2-entry LUT where index 0 is transparent and index 1 is the segment color
  const redData = new Uint16Array([0, color[0]])
  const greenData = new Uint16Array([0, color[1]])
  const blueData = new Uint16Array([0, color[2]])

  return {
    uid: `segment-${segmentUID}-color-lut`,
    redDescriptor: [2, 0, 16, 0],
    greenDescriptor: [2, 0, 16, 0],
    blueDescriptor: [2, 0, 16, 0],
    redData,
    greenData,
    blueData
  }
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

      if (segment !== undefined && segment !== null && segment.RecommendedDisplayCIELabValue !== undefined && segment.RecommendedDisplayCIELabValue !== null && Array.isArray(segment.RecommendedDisplayCIELabValue)) {
        /** Convert CIELab to RGB */
        /** This is a simplified conversion - in practice you might want a more accurate algorithm */
        const labValues = segment.RecommendedDisplayCIELabValue as number[]
        if (labValues.length >= 3) {
          const [L, a, b] = labValues

          /** Simple CIELab to RGB conversion (approximate) */
          /** This is a basic conversion and may not be perfectly accurate */
          const rgb = labToRgb(L, a, b)
          if (rgb !== null) {
            return rgb
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
 * Convert CIELab color space to RGB (simplified conversion)
 * This is an approximate conversion and may not be perfectly accurate
 */
const labToRgb = (L: number, a: number, b: number): number[] | null => {
  try {
    /** Convert CIELab to XYZ */
    const fy = (L + 16) / 116
    const fx = a / 500 + fy
    const fz = fy - b / 200

    const xr = fx > 0.2069 ? Math.pow(fx, 3) : (fx - 16 / 116) / 7.787
    const yr = fy > 0.2069 ? Math.pow(fy, 3) : (fy - 16 / 116) / 7.787
    const zr = fz > 0.2069 ? Math.pow(fz, 3) : (fz - 16 / 116) / 7.787

    /** Reference white point (D65) */
    const X = xr * 0.95047
    const Y = yr * 1.00000
    const Z = zr * 1.08883

    /** Convert XYZ to RGB (sRGB color space) */
    const r = X * 3.2406 + Y * -1.5372 + Z * -0.4986
    const g = X * -0.9689 + Y * 1.8758 + Z * 0.0415
    const bVal = X * 0.0557 + Y * -0.2040 + Z * 1.0570

    /** Apply gamma correction and clamp values */
    const gammaCorrect = (c: number): number => {
      const corrected = c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c
      return Math.max(0, Math.min(255, Math.round(corrected * 255)))
    }

    return [gammaCorrect(r), gammaCorrect(g), gammaCorrect(bVal)]
  } catch (error) {
    /** Failed to convert CIELab to RGB */
    console.warn('Failed to convert CIELab to RGB:', error)
    return null
  }
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
