import {
  computeScaleBar,
  formatCursorLabel,
  formatLength,
  formatMagnification,
  formatMagnificationLabel,
  formatMicronsPerPixel,
  micronsPerScreenPixel,
} from '../scaleBar'

describe('micronsPerScreenPixel', () => {
  it('uses the projection point resolution when available', () => {
    expect(
      micronsPerScreenPixel({
        resolution: 4,
        center: [0, 0],
        pointResolution: (resolution) => (resolution * 0.00025) / 1000,
      }),
    ).toBeCloseTo(1, 10)
  })

  it('falls back to meters per unit', () => {
    expect(
      micronsPerScreenPixel({
        resolution: 2,
        center: [0, 0],
        metersPerUnit: 1e-6,
      }),
    ).toBeCloseTo(2, 10)
  })

  it('returns undefined before the view is ready', () => {
    expect(
      micronsPerScreenPixel({ resolution: undefined, center: [0, 0] }),
    ).toBeUndefined()
    expect(
      micronsPerScreenPixel({ resolution: 1, center: undefined }),
    ).toBeUndefined()
    expect(
      micronsPerScreenPixel({
        resolution: 1,
        center: [0, 0],
        pointResolution: () => Number.NaN,
      }),
    ).toBeUndefined()
  })
})

describe('formatMagnificationLabel', () => {
  it('combines magnification and resolution', () => {
    expect(formatMagnificationLabel(0.25)).toBe('40× · 0.25 µm/px')
  })

  it('shows dashes without a resolution', () => {
    expect(formatMagnificationLabel(undefined)).toBe('— · — µm/px')
  })
})

describe('formatCursorLabel', () => {
  it('formats slide coordinates in millimeters', () => {
    expect(formatCursorLabel([12.345678, 45.6])).toBe(
      'x 12.3457 · y 45.6000 mm',
    )
  })

  it('shows dashes without a position', () => {
    expect(formatCursorLabel(undefined)).toBe('x — · y — mm')
    expect(formatCursorLabel([Number.NaN, 1])).toBe('x — · y — mm')
  })
})

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
