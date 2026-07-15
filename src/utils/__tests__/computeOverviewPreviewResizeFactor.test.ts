import {
  computeOverviewPreviewResizeFactor,
  SLIDE_PREVIEW_FALLBACK_WIDTH_PX,
  SLIDE_PREVIEW_HEIGHT_PX,
} from '../computeOverviewPreviewResizeFactor'

describe('computeOverviewPreviewResizeFactor', () => {
  it('scales down large matrices to fit the preview container', () => {
    const factor = computeOverviewPreviewResizeFactor(
      { TotalPixelMatrixColumns: 50_000, TotalPixelMatrixRows: 40_000 },
      280,
      100,
    )
    expect(factor).toBeCloseTo(100 / 40_000, 6)
  })

  it('does not upscale small matrices', () => {
    expect(
      computeOverviewPreviewResizeFactor(
        { TotalPixelMatrixColumns: 200, TotalPixelMatrixRows: 100 },
        280,
        100,
      ),
    ).toBe(1)
  })

  it('uses fallback dimensions when the container is not yet measured', () => {
    const factor = computeOverviewPreviewResizeFactor(
      { TotalPixelMatrixColumns: 10_000, TotalPixelMatrixRows: 8_000 },
      0,
      0,
    )
    expect(factor).toBeCloseTo(
      SLIDE_PREVIEW_HEIGHT_PX / 8_000,
      6,
    )
    expect(factor).toBeLessThan(
      SLIDE_PREVIEW_FALLBACK_WIDTH_PX / 10_000,
    )
  })

  it('returns 1 for invalid matrix metadata', () => {
    expect(
      computeOverviewPreviewResizeFactor(
        { TotalPixelMatrixColumns: 0, TotalPixelMatrixRows: 100 },
        280,
        100,
      ),
    ).toBe(1)
  })
})
