import {
  computeScaleBar,
  formatLength,
  formatMagnification,
  formatMicronsPerPixel,
} from '../scaleBar'

describe('computeScaleBar', () => {
  it('picks the largest 1/2/5 step that fits', () => {
    expect(computeScaleBar(5.21, 96)).toEqual({ widthPx: 96, label: '500 µm' })
    expect(computeScaleBar(5.2, 96)).toEqual({ widthPx: 38, label: '200 µm' })
    expect(computeScaleBar(0.5, 96)).toEqual({ widthPx: 40, label: '20 µm' })
  })

  it('switches to millimeters at 1000 µm', () => {
    expect(computeScaleBar(23.8, 96)).toEqual({ widthPx: 84, label: '2 mm' })
  })

  it('returns null for invalid resolutions', () => {
    expect(computeScaleBar(0)).toBeNull()
    expect(computeScaleBar(-1)).toBeNull()
    expect(computeScaleBar(Number.NaN)).toBeNull()
  })
})

describe('formatLength', () => {
  it('formats micrometers and millimeters', () => {
    expect(formatLength(0.5)).toBe('0.5 µm')
    expect(formatLength(500)).toBe('500 µm')
    expect(formatLength(2000)).toBe('2 mm')
  })
})

describe('formatMagnification', () => {
  it('uses the 10 µm/px ≈ 1× convention', () => {
    expect(formatMagnification(0.25)).toBe('40×')
    expect(formatMagnification(0.5)).toBe('20×')
    expect(formatMagnification(4)).toBe('2.5×')
    expect(formatMagnification(5)).toBe('2×')
    expect(formatMagnification(23.8)).toBe('0.42×')
  })

  it('returns a dash for invalid input', () => {
    expect(formatMagnification(0)).toBe('—')
  })
})

describe('formatMicronsPerPixel', () => {
  it('adapts precision to magnitude', () => {
    expect(formatMicronsPerPixel(0.5)).toBe('0.50')
    expect(formatMicronsPerPixel(12.34)).toBe('12.3')
    expect(formatMicronsPerPixel(250.4)).toBe('250')
  })

  it('returns a dash for invalid input', () => {
    expect(formatMicronsPerPixel(Number.NaN)).toBe('—')
  })
})
