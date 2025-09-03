import {
  generateSegmentColor,
  rgbToHex,
  hexToRgb,
  isLightColor,
  getContrastColor,
  extractSegmentColorFromMetadata,
  getSegmentColor
} from '../segmentColors'

describe('segmentColors utility', () => {
  describe('generateSegmentColor', () => {
    it('should generate distinct colors for different indices', () => {
      const color1 = generateSegmentColor(0)
      const color2 = generateSegmentColor(1)
      const color3 = generateSegmentColor(2)

      expect(color1).toEqual([255, 0, 0]) // Red
      expect(color2).toEqual([0, 255, 0]) // Green
      expect(color3).toEqual([0, 0, 255]) // Blue
    })

    it('should wrap around the color palette for large indices', () => {
      const color = generateSegmentColor(20)
      expect(color).toEqual([255, 0, 255]) // Magenta (index 4, since 20 % 16 = 4)
    })
  })

  describe('rgbToHex', () => {
    it('should convert RGB values to hex string', () => {
      expect(rgbToHex([255, 0, 0])).toBe('#ff0000')
      expect(rgbToHex([0, 255, 0])).toBe('#00ff00')
      expect(rgbToHex([0, 0, 255])).toBe('#0000ff')
      expect(rgbToHex([128, 128, 128])).toBe('#808080')
    })

    it('should round RGB values', () => {
      expect(rgbToHex([255.7, 0.3, 128.9])).toBe('#ff0081')
    })
  })

  describe('hexToRgb', () => {
    it('should convert hex string to RGB values', () => {
      expect(hexToRgb('#ff0000')).toEqual([255, 0, 0])
      expect(hexToRgb('#00ff00')).toEqual([0, 255, 0])
      expect(hexToRgb('#0000ff')).toEqual([0, 0, 255])
      expect(hexToRgb('#808080')).toEqual([128, 128, 128])
    })

    it('should handle hex strings without #', () => {
      expect(hexToRgb('ff0000')).toEqual([255, 0, 0])
    })

    it('should return [0, 0, 0] for invalid hex strings', () => {
      expect(hexToRgb('invalid')).toEqual([0, 0, 0])
      expect(hexToRgb('')).toEqual([0, 0, 0])
    })
  })

  describe('isLightColor', () => {
    it('should identify light colors correctly', () => {
      expect(isLightColor([255, 255, 255])).toBe(true) // White
      expect(isLightColor([255, 255, 0])).toBe(true) // Yellow
      expect(isLightColor([0, 255, 255])).toBe(true) // Cyan
    })

    it('should identify dark colors correctly', () => {
      expect(isLightColor([0, 0, 0])).toBe(false) // Black
      expect(isLightColor([255, 0, 0])).toBe(false) // Red
      expect(isLightColor([0, 0, 255])).toBe(false) // Blue
    })
  })

  describe('getContrastColor', () => {
    it('should return black for light colors', () => {
      expect(getContrastColor([255, 255, 255])).toEqual([0, 0, 0])
      expect(getContrastColor([255, 255, 0])).toEqual([0, 0, 0])
    })

    it('should return white for dark colors', () => {
      expect(getContrastColor([0, 0, 0])).toEqual([255, 255, 255])
      expect(getContrastColor([255, 0, 0])).toEqual([255, 255, 255])
    })
  })

  describe('extractSegmentColorFromMetadata', () => {
    it('should extract color from valid DICOM metadata', () => {
      const metadata = {
        SegmentSequence: [
          {
            SegmentNumber: 1,
            RecommendedDisplayCIELabValue: [50, 10, -20]
          }
        ]
      }

      const color = extractSegmentColorFromMetadata(metadata, 1)
      expect(color).toBeDefined()
      expect(Array.isArray(color)).toBe(true)
      if (color !== null) {
        expect(color.length).toBe(3)
      }
    })

    it('should return null for missing segment', () => {
      const metadata = {
        SegmentSequence: [
          {
            SegmentNumber: 2,
            RecommendedDisplayCIELabValue: [50, 10, -20]
          }
        ]
      }

      const color = extractSegmentColorFromMetadata(metadata, 1)
      expect(color).toBeNull()
    })

    it('should return null for missing color data', () => {
      const metadata = {
        SegmentSequence: [
          {
            SegmentNumber: 1
            // No RecommendedDisplayCIELabValue
          }
        ]
      }

      const color = extractSegmentColorFromMetadata(metadata, 1)
      expect(color).toBeNull()
    })

    it('should handle missing SegmentSequence gracefully', () => {
      const metadata = {}
      const color = extractSegmentColorFromMetadata(metadata, 1)
      expect(color).toBeNull()
    })
  })

  describe('getSegmentColor', () => {
    it('should return metadata color when available', () => {
      const metadata = {
        SegmentSequence: [
          {
            SegmentNumber: 1,
            RecommendedDisplayCIELabValue: [50, 10, -20]
          }
        ]
      }

      const color = getSegmentColor(metadata, 1, 0)
      expect(color).toBeDefined()
      expect(Array.isArray(color)).toBe(true)
      expect(color.length).toBe(3)
    })

    it('should fall back to generated color when metadata is not available', () => {
      const metadata = {}
      const color = getSegmentColor(metadata, 1, 0)
      expect(color).toEqual([255, 0, 0]) // Red (index 0)
    })
  })
})
