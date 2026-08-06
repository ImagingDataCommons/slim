import {
  fitOverviewMapSize,
  MAX_OVERVIEW_FRACTION,
  MIN_OVERVIEW_SIDE_PX,
  overviewMapSizeBounds,
  PREFERRED_OVERVIEW_FRACTION,
} from '../fitOverviewMapSize'

describe('fitOverviewMapSize', () => {
  it('fits a normal aspect ratio inside the preferred box', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    const fitted = fitOverviewMapSize(400, 300, bounds)
    expect(fitted.width).toBeLessThanOrEqual(bounds.preferredMaxWidth + 0.01)
    expect(fitted.height).toBeLessThanOrEqual(bounds.preferredMaxHeight + 0.01)
    expect(fitted.width / fitted.height).toBeCloseTo(400 / 300)
  })

  it('grows wide maps that undershoot the preferred box up to the min side', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    /** Aspect 6: preferred height is 75px; scale up to 80px stays under max width. */
    const fitted = fitOverviewMapSize(600, 100, bounds)
    expect(fitted.height).toBeCloseTo(MIN_OVERVIEW_SIDE_PX)
    expect(fitted.width).toBeCloseTo(MIN_OVERVIEW_SIDE_PX * 6)
    expect(fitted.width).toBeLessThan(bounds.maxMapWidth)
  })

  it('caps extremely wide maps at the max width fraction (not full viewport)', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    const fitted = fitOverviewMapSize(4000, 40, bounds)
    expect(fitted.width).toBeLessThanOrEqual(bounds.maxMapWidth + 0.01)
    expect(fitted.width).toBeCloseTo(1000 * MAX_OVERVIEW_FRACTION)
    expect(fitted.width / fitted.height).toBeCloseTo(100)
    expect(fitted.width).toBeLessThan(1000 - 16)
  })

  it('grows tall maps that undershoot the preferred box up to the min side', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    /** Aspect 1/5: preferred width is 72px; scale up to 80px stays under max height. */
    const fitted = fitOverviewMapSize(100, 500, bounds)
    expect(fitted.width).toBeCloseTo(MIN_OVERVIEW_SIDE_PX)
    expect(fitted.height).toBeCloseTo(MIN_OVERVIEW_SIDE_PX * 5)
    expect(fitted.height).toBeLessThan(bounds.maxMapHeight)
  })

  it('caps extremely tall maps at the max height fraction (not full viewport)', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    const fitted = fitOverviewMapSize(40, 4000, bounds)
    expect(fitted.height).toBeLessThanOrEqual(bounds.maxMapHeight + 0.01)
    expect(fitted.height).toBeCloseTo(800 * MAX_OVERVIEW_FRACTION)
    expect(fitted.width / fitted.height).toBeCloseTo(40 / 4000)
    expect(fitted.height).toBeLessThan(800 - 20)
  })

  it('treats wide and tall extremes with matching max fractions', () => {
    const bounds = overviewMapSizeBounds(1000, 1000)
    const wide = fitOverviewMapSize(5000, 50, bounds)
    const tall = fitOverviewMapSize(50, 5000, bounds)
    expect(wide.width / 1000).toBeCloseTo(MAX_OVERVIEW_FRACTION)
    expect(tall.height / 1000).toBeCloseTo(MAX_OVERVIEW_FRACTION)
    expect(wide.width).toBeCloseTo(tall.height)
    expect(wide.height).toBeCloseTo(tall.width)
  })

  it('exposes preferred bounds below the max cap', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    expect(bounds.preferredMaxWidth).toBeCloseTo(1000 * PREFERRED_OVERVIEW_FRACTION)
    expect(bounds.preferredMaxHeight).toBeCloseTo(800 * PREFERRED_OVERVIEW_FRACTION)
    expect(bounds.maxMapWidth).toBeCloseTo(1000 * MAX_OVERVIEW_FRACTION)
    expect(bounds.maxMapHeight).toBeCloseTo(800 * MAX_OVERVIEW_FRACTION)
  })
})
