import {
  fitOverviewMapSize,
  MIN_OVERVIEW_HEIGHT_PX,
  overviewMapSizeBounds,
} from '../fitOverviewMapSize'

describe('fitOverviewMapSize', () => {
  it('raises short wide maps to the minimum height when aspect allows', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    const fitted = fitOverviewMapSize(80, 40, bounds)
    expect(fitted.height).toBe(MIN_OVERVIEW_HEIGHT_PX)
    expect(fitted.width).toBeCloseTo(MIN_OVERVIEW_HEIGHT_PX * 2)
  })

  it('spills toward full width to approach the minimum height', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    const fitted = fitOverviewMapSize(400, 40, bounds)
    expect(fitted.height).toBeGreaterThanOrEqual(MIN_OVERVIEW_HEIGHT_PX)
    expect(fitted.width / fitted.height).toBeCloseTo(10)
  })

  it('shrinks tall maps to the max height', () => {
    const bounds = overviewMapSizeBounds(400, 200)
    const fitted = fitOverviewMapSize(100, 500, bounds)
    expect(fitted.height).toBeLessThanOrEqual(bounds.maxMapHeight + 0.01)
    expect(fitted.width / fitted.height).toBeCloseTo(100 / 500)
  })

  it('keeps aspect ratio when clamping to max width', () => {
    const bounds = overviewMapSizeBounds(300, 800)
    const fitted = fitOverviewMapSize(2000, 100, bounds)
    expect(fitted.width).toBeLessThanOrEqual(bounds.maxMapWidth + 0.01)
    expect(fitted.width / fitted.height).toBeCloseTo(20)
  })
})
