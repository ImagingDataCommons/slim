import {
  computeOverviewPreviewResizeFactor,
  SLIDE_PREVIEW_FALLBACK_WIDTH_PX,
  SLIDE_PREVIEW_HEIGHT_PX,
} from '../computeOverviewPreviewResizeFactor'

describe('computeOverviewPreviewResizeFactor', () => {
  it('scales down large matrices to integer viewport dimensions', () => {
    const cols = 50_000
    const rows = 40_000
    const factor = computeOverviewPreviewResizeFactor(
      { TotalPixelMatrixColumns: cols, TotalPixelMatrixRows: rows },
      280,
      100,
    )
    expect(factor).toBe(100 / rows)
    expect(cols * factor).toBe(125)
    expect(rows * factor).toBe(100)
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
    const cols = 10_000
    const rows = 8_000
    const factor = computeOverviewPreviewResizeFactor(
      { TotalPixelMatrixColumns: cols, TotalPixelMatrixRows: rows },
      0,
      0,
    )
    expect(factor).toBe(SLIDE_PREVIEW_HEIGHT_PX / rows)
    expect(cols * factor).toBe(
      (cols * SLIDE_PREVIEW_HEIGHT_PX) / rows,
    )
    expect(factor).toBeLessThan(SLIDE_PREVIEW_FALLBACK_WIDTH_PX / cols)
  })

  it('falls back to 1 when no integer downscale fits the tile', () => {
    /**
     * Coprime matrix sizes: only multiples of `rows` keep both viewport axes
     * integer, so a 100px-tall tile cannot downscale via viewport.
     */
    expect(
      computeOverviewPreviewResizeFactor(
        { TotalPixelMatrixColumns: 48_001, TotalPixelMatrixRows: 38_300 },
        280,
        100,
      ),
    ).toBe(1)
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
