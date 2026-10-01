export type ActiveRoiTool = 'draw' | 'modify' | 'translate' | null

export interface RoiToolFlags {
  isRoiDrawingActive: boolean
  isRoiModificationActive: boolean
  isRoiTranslationActive: boolean
}

/** Toolbar tool to highlight; drawing wins if several flags are set. */
export function deriveActiveRoiTool(flags: RoiToolFlags): ActiveRoiTool {
  if (flags.isRoiDrawingActive) return 'draw'
  if (flags.isRoiModificationActive) return 'modify'
  if (flags.isRoiTranslationActive) return 'translate'
  return null
}
