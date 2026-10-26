import type { ViewerInteraction } from './viewerInteraction'

/**
 * Which DMV interactions to deactivate before entering a toolbar mode.
 * Callers still activate the target interaction and update React state.
 */
export type ToolMode =
  | 'select'
  | 'draw'
  | 'modify'
  | 'translate'
  | 'goTo'
  | 'hide'
  | 'show'
  | 'cancel'

export interface ToolModePlan {
  deactivate: ReadonlyArray<'draw' | 'modify' | 'snap' | 'translate' | 'select'>
  activateSelect: boolean
}

/** Plan the DMV interaction teardown for a toolbar / shortcut action. */
export function planToolMode(
  mode: ToolMode,
  interaction: Pick<
    ViewerInteraction,
    | 'isRoiDrawingActive'
    | 'isRoiModificationActive'
    | 'isRoiTranslationActive'
    | 'areRoisHidden'
  >,
  viewerFlags: {
    isModifyInteractionActive: boolean
    isTranslateInteractionActive: boolean
  },
): ToolModePlan | null {
  switch (mode) {
    case 'select':
      return {
        deactivate: ['draw', 'modify', 'snap', 'translate'],
        activateSelect: true,
      }
    case 'draw':
      if (interaction.isRoiDrawingActive) {
        return { deactivate: ['draw'], activateSelect: true }
      }
      return {
        deactivate: ['select', 'snap', 'translate', 'modify'],
        activateSelect: false,
      }
    case 'modify':
      if (viewerFlags.isModifyInteractionActive) {
        return { deactivate: ['modify', 'snap'], activateSelect: true }
      }
      return {
        deactivate: ['draw', 'translate', 'select'],
        activateSelect: false,
      }
    case 'translate':
      if (viewerFlags.isTranslateInteractionActive) {
        return { deactivate: ['translate'], activateSelect: true }
      }
      return {
        deactivate: ['modify', 'snap', 'draw', 'select'],
        activateSelect: false,
      }
    case 'goTo':
      return {
        deactivate: ['draw', 'modify', 'snap', 'translate', 'select'],
        activateSelect: false,
      }
    case 'hide':
      if (interaction.areRoisHidden) return null
      return {
        deactivate: ['draw', 'snap', 'translate', 'select', 'modify'],
        activateSelect: false,
      }
    case 'show':
      if (!interaction.areRoisHidden) return null
      return { deactivate: [], activateSelect: true }
    case 'cancel':
      if (interaction.isRoiDrawingActive) {
        return { deactivate: ['draw'], activateSelect: true }
      }
      if (interaction.isRoiModificationActive) {
        return { deactivate: ['modify'], activateSelect: true }
      }
      if (interaction.isRoiTranslationActive) {
        return { deactivate: ['translate'], activateSelect: true }
      }
      return { deactivate: [], activateSelect: false }
  }
}
