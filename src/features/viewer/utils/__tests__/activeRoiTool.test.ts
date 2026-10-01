import { deriveActiveRoiTool } from '../activeRoiTool'

const NONE = {
  isRoiDrawingActive: false,
  isRoiModificationActive: false,
  isRoiTranslationActive: false,
}

describe('deriveActiveRoiTool', () => {
  it('returns null when no tool is active', () => {
    expect(deriveActiveRoiTool(NONE)).toBeNull()
  })

  it('maps each flag to its tool', () => {
    expect(deriveActiveRoiTool({ ...NONE, isRoiDrawingActive: true })).toBe(
      'draw',
    )
    expect(
      deriveActiveRoiTool({ ...NONE, isRoiModificationActive: true }),
    ).toBe('modify')
    expect(deriveActiveRoiTool({ ...NONE, isRoiTranslationActive: true })).toBe(
      'translate',
    )
  })

  it('prefers drawing over other flags', () => {
    expect(
      deriveActiveRoiTool({
        isRoiDrawingActive: true,
        isRoiModificationActive: true,
        isRoiTranslationActive: true,
      }),
    ).toBe('draw')
  })
})
