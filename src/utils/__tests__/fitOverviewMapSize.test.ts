import {
  fitOverviewMapSize,
  MAX_OVERVIEW_BOX_PX,
  MAX_OVERVIEW_FRACTION,
  overviewMapSizeBounds,
  PREFERRED_OVERVIEW_BOX_PX,
  PREFERRED_OVERVIEW_FRACTION,
} from '../fitOverviewMapSize'

describe('fitOverviewMapSize', () => {
  it('fits a normal aspect ratio inside the OL-sized preferred box', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    const fitted = fitOverviewMapSize(400, 300, bounds)
    expect(fitted.width).toBeLessThanOrEqual(bounds.preferredMaxWidth + 0.01)
    expect(fitted.height).toBeLessThanOrEqual(bounds.preferredMaxHeight + 0.01)
    expect(fitted.width / fitted.height).toBeCloseTo(400 / 300)
    expect(Math.max(fitted.width, fitted.height)).toBeLessThanOrEqual(
      PREFERRED_OVERVIEW_BOX_PX + 0.01,
    )
  })

  it('grows wide maps toward the min side then respects the max box', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    /** Aspect 6: min-side growth wants 48×288, then max width 200 scales it down. */
    const fitted = fitOverviewMapSize(600, 100, bounds)
    expect(fitted.width).toBeCloseTo(MAX_OVERVIEW_BOX_PX)
    expect(fitted.height).toBeCloseTo(MAX_OVERVIEW_BOX_PX / 6)
    expect(fitted.width / fitted.height).toBeCloseTo(6)
  })

  it('caps extremely wide maps at the absolute OL-inspired max box', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    const fitted = fitOverviewMapSize(4000, 40, bounds)
    expect(fitted.width).toBeLessThanOrEqual(bounds.maxMapWidth + 0.01)
    expect(fitted.width).toBeCloseTo(MAX_OVERVIEW_BOX_PX)
    expect(fitted.width / fitted.height).toBeCloseTo(100)
    expect(fitted.width).toBeLessThanOrEqual(1000 * MAX_OVERVIEW_FRACTION)
  })

  it('grows tall maps toward the min side then respects the max box', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    /** Aspect 1/5: min-side growth wants 48×240, then max height 200 scales it down. */
    const fitted = fitOverviewMapSize(100, 500, bounds)
    expect(fitted.height).toBeCloseTo(MAX_OVERVIEW_BOX_PX)
    expect(fitted.width).toBeCloseTo(MAX_OVERVIEW_BOX_PX / 5)
    expect(fitted.width / fitted.height).toBeCloseTo(1 / 5)
  })

  it('caps extremely tall maps at the absolute OL-inspired max box', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    const fitted = fitOverviewMapSize(40, 4000, bounds)
    expect(fitted.height).toBeLessThanOrEqual(bounds.maxMapHeight + 0.01)
    expect(fitted.height).toBeCloseTo(MAX_OVERVIEW_BOX_PX)
    expect(fitted.width / fitted.height).toBeCloseTo(40 / 4000)
  })

  it('treats wide and tall extremes with matching absolute box caps', () => {
    const bounds = overviewMapSizeBounds(1000, 1000)
    const wide = fitOverviewMapSize(5000, 50, bounds)
    const tall = fitOverviewMapSize(50, 5000, bounds)
    expect(wide.width).toBeCloseTo(MAX_OVERVIEW_BOX_PX)
    expect(tall.height).toBeCloseTo(MAX_OVERVIEW_BOX_PX)
    expect(wide.width).toBeCloseTo(tall.height)
    expect(wide.height).toBeCloseTo(tall.width)
  })

  it('exposes preferred bounds at the OpenLayers default 150px box', () => {
    const bounds = overviewMapSizeBounds(1000, 800)
    expect(bounds.preferredMaxWidth).toBeCloseTo(PREFERRED_OVERVIEW_BOX_PX)
    expect(bounds.preferredMaxHeight).toBeCloseTo(PREFERRED_OVERVIEW_BOX_PX)
    expect(bounds.maxMapWidth).toBeCloseTo(MAX_OVERVIEW_BOX_PX)
    expect(bounds.maxMapHeight).toBeCloseTo(
      Math.min(800 * MAX_OVERVIEW_FRACTION, MAX_OVERVIEW_BOX_PX),
    )
    expect(bounds.preferredMaxWidth).toBeLessThanOrEqual(
      1000 * PREFERRED_OVERVIEW_FRACTION + 0.01,
    )
  })

  it('stays near the OL default size on large viewports', () => {
    const bounds = overviewMapSizeBounds(2400, 1600)
    const square = fitOverviewMapSize(1000, 1000, bounds)
    const tall = fitOverviewMapSize(80, 4000, bounds)
    const wide = fitOverviewMapSize(4000, 80, bounds)
    expect(Math.max(square.width, square.height)).toBeCloseTo(
      PREFERRED_OVERVIEW_BOX_PX,
    )
    expect(tall.height).toBeLessThanOrEqual(MAX_OVERVIEW_BOX_PX + 0.01)
    expect(wide.width).toBeLessThanOrEqual(MAX_OVERVIEW_BOX_PX + 0.01)
    expect(tall.height).toBeLessThan(1600 * 0.25)
    expect(wide.width).toBeLessThan(2400 * 0.25)
  })
})
