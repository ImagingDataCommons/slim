import type { RoiToolFlags } from './activeRoiTool'
import { EMPTY_GO_TO_INPUT, type GoToField, type GoToInput } from './goTo'

/** ROI tool modes and the dialogs that open and close with them */
export interface ViewerInteraction extends RoiToolFlags {
  isAnnotationModalVisible: boolean
  isSelectedRoiModalVisible: boolean
  isGoToModalVisible: boolean
  isReportModalVisible: boolean
  isRoiRemovalConfirmVisible: boolean
  areRoisHidden: boolean
  /** Raw text of the "Go to position" fields */
  goToInput: GoToInput
}

export const INITIAL_VIEWER_INTERACTION: ViewerInteraction = {
  isRoiDrawingActive: false,
  isRoiModificationActive: false,
  isRoiTranslationActive: false,
  isAnnotationModalVisible: false,
  isSelectedRoiModalVisible: false,
  isGoToModalVisible: false,
  isReportModalVisible: false,
  isRoiRemovalConfirmVisible: false,
  areRoisHidden: false,
  goToInput: EMPTY_GO_TO_INPUT,
}

export type ViewerInteractionAction =
  | { type: 'cancel' }
  | { type: 'startDrawing' }
  | { type: 'stopDrawing' }
  | { type: 'startModifying' }
  | { type: 'startTranslating' }
  | { type: 'stopTools' }
  | { type: 'completeAnnotationConfiguration' }
  | { type: 'cancelAnnotationConfiguration' }
  | { type: 'openGoTo' }
  | { type: 'closeGoTo' }
  | { type: 'changeGoToInput'; field: GoToField; value: string }
  | { type: 'setSelectedRoiModalVisible'; isVisible: boolean }
  | { type: 'setReportModalVisible'; isVisible: boolean }
  | { type: 'setRoiRemovalConfirmVisible'; isVisible: boolean }
  | { type: 'hideRois' }
  | { type: 'showRois' }

const NO_TOOL: RoiToolFlags = {
  isRoiDrawingActive: false,
  isRoiModificationActive: false,
  isRoiTranslationActive: false,
}

const NO_TOOL_DIALOGS = {
  isAnnotationModalVisible: false,
  isSelectedRoiModalVisible: false,
  isGoToModalVisible: false,
}

export function viewerInteractionReducer(
  state: ViewerInteraction,
  action: ViewerInteractionAction,
): ViewerInteraction {
  switch (action.type) {
    case 'cancel':
      return {
        ...state,
        ...NO_TOOL,
        ...NO_TOOL_DIALOGS,
        goToInput: EMPTY_GO_TO_INPUT,
      }
    case 'startDrawing':
      return {
        ...state,
        ...NO_TOOL_DIALOGS,
        ...NO_TOOL,
        isAnnotationModalVisible: true,
        isRoiDrawingActive: true,
      }
    case 'stopDrawing':
      return { ...state, ...NO_TOOL, ...NO_TOOL_DIALOGS }
    case 'startModifying':
      return { ...state, ...NO_TOOL, isRoiModificationActive: true }
    case 'startTranslating':
      return { ...state, ...NO_TOOL, isRoiTranslationActive: true }
    case 'stopTools':
      return { ...state, ...NO_TOOL }
    case 'completeAnnotationConfiguration':
      return {
        ...state,
        isAnnotationModalVisible: false,
        isRoiDrawingActive: true,
      }
    case 'cancelAnnotationConfiguration':
      return {
        ...state,
        isAnnotationModalVisible: false,
        isRoiDrawingActive: false,
      }
    case 'openGoTo':
      return {
        ...state,
        ...NO_TOOL,
        ...NO_TOOL_DIALOGS,
        isReportModalVisible: false,
        isGoToModalVisible: true,
        goToInput: EMPTY_GO_TO_INPUT,
      }
    case 'closeGoTo':
      return {
        ...state,
        isGoToModalVisible: false,
        goToInput: EMPTY_GO_TO_INPUT,
      }
    case 'changeGoToInput':
      return {
        ...state,
        goToInput: { ...state.goToInput, [action.field]: action.value },
      }
    case 'setSelectedRoiModalVisible':
      return { ...state, isSelectedRoiModalVisible: action.isVisible }
    case 'setReportModalVisible':
      return { ...state, isReportModalVisible: action.isVisible }
    case 'setRoiRemovalConfirmVisible':
      return { ...state, isRoiRemovalConfirmVisible: action.isVisible }
    case 'hideRois':
      return { ...state, ...NO_TOOL, areRoisHidden: true }
    case 'showRois':
      return { ...state, areRoisHidden: false }
  }
}
