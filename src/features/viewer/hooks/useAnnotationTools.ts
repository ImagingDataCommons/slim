/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import { codedConceptKey } from '../../../utils/dicom/codedConcept'
import { logger } from '../../../utils/logger'
import type { MeasurementUnit } from '../../preferences/utils/preferences'
import { notifyVisualizationError } from '../services/derivedDataLoaders'
import { publishToast } from '../services/toast'
import type { ViewerSession, ViewerSessionRef } from '../services/viewerSession'
import type { AnnotationDraft } from '../utils/annotationDraft'
import { planToolMode } from '../utils/annotationToolModes'
import { applyToolModePlan } from '../utils/applyToolModePlan'
import {
  choosePyramidLevel,
  type GoToField,
  type GoToRanges,
  validateGoToInput,
} from '../utils/goTo'
import type { ViewerShortcutAction } from '../utils/keyboardShortcuts'
import type {
  ViewerInteraction,
  ViewerInteractionAction,
} from '../utils/viewerInteraction'
import type { RoisApi } from './useRois'

type RoiStyle = dmv.viewer.ROIStyleOptions

export interface AnnotationToolsApi {
  onSelect: () => void
  onDraw: () => void
  onModify: () => void
  onTranslate: () => void
  onGoTo: () => void
  onRemove: () => void
  onToggleRoiVisibility: () => void
  onGoToInputChange: (field: GoToField, value: string) => void
  onSlidePositionSelection: () => void
  onSlidePositionSelectionCancellation: () => void
  onAnnotationConfigurationCompletion: () => void
  onAnnotationConfigurationCancellation: () => void
  onRoiRemovalConfirmation: () => void
  onRoiRemovalCancellation: () => void
  onRoiDetailsCancellation: () => void
  onShortcut: (action: ViewerShortcutAction) => void
}

/** Style for a newly drawn ROI of the draft's finding (also the preview) */
export function drawStyleFor(
  session: ViewerSession,
  draft: AnnotationDraft,
  defaultRoiStyle: RoiStyle,
): RoiStyle {
  const key =
    draft.finding !== undefined ? codedConceptKey(draft.finding) : undefined
  return session.roiStyles.drawStyle(key, defaultRoiStyle)
}

/**
 * Toolbar and keyboard actions on ROIs: drawing, modifying, translating,
 * removing, hiding, and jumping to a slide position.
 */
export function useAnnotationTools({
  sessionRef,
  interaction,
  dispatch,
  rois,
  draft,
  defaultRoiStyle,
  measurementUnit,
  confirmRoiRemoval,
  goToRanges,
  onSave,
  canWriteRois = true,
}: {
  sessionRef: ViewerSessionRef
  interaction: ViewerInteraction
  dispatch: React.Dispatch<ViewerInteractionAction>
  rois: Pick<
    RoisApi,
    | 'selectedRoiUIDs'
    | 'visibleRoiUIDs'
    | 'addStyledRoi'
    | 'removeRois'
    | 'restyleSelected'
  >
  draft: AnnotationDraft
  defaultRoiStyle: RoiStyle
  /** Preferred unit for DMV measurement markup and ROI Num items */
  measurementUnit: MeasurementUnit
  confirmRoiRemoval: boolean
  goToRanges: GoToRanges
  onSave: () => void
  /** False when `disableAnnotationTools` is set: Go to navigates only */
  canWriteRois?: boolean
}): AnnotationToolsApi {
  const viewerOf = (): dmv.viewer.VolumeImageViewer | undefined =>
    sessionRef.current?.volumeViewer

  const viewerFlags = (
    viewer: dmv.viewer.VolumeImageViewer,
  ): {
    isModifyInteractionActive: boolean
    isTranslateInteractionActive: boolean
  } => ({
    isModifyInteractionActive: viewer.isModifyInteractionActive,
    isTranslateInteractionActive: viewer.isTranslateInteractionActive,
  })

  const onSelect = (): void => {
    const viewer = viewerOf()
    if (viewer === undefined) return
    logger.log('activate selection of ROIs')
    const plan = planToolMode('select', interaction, viewerFlags(viewer))
    if (plan === null) return
    applyToolModePlan(viewer, plan)
    /** Clears draw/modify/translate and the annotation configuration dialog */
    dispatch({ type: 'stopDrawing' })
  }

  const onDraw = (): void => {
    const viewer = viewerOf()
    if (viewer === undefined) return
    const plan = planToolMode('draw', interaction, viewerFlags(viewer))
    if (plan === null) return
    if (interaction.isRoiDrawingActive) {
      logger.log('deactivate drawing of ROIs')
      applyToolModePlan(viewer, plan)
      dispatch({ type: 'stopDrawing' })
    } else {
      logger.log('activate drawing of ROIs')
      dispatch({ type: 'startDrawing' })
      applyToolModePlan(viewer, plan)
    }
  }

  const onModify = (): void => {
    const viewer = viewerOf()
    if (viewer === undefined) return
    logger.log('toggle modification of ROIs')
    const plan = planToolMode('modify', interaction, viewerFlags(viewer))
    if (plan === null) return
    if (viewer.isModifyInteractionActive) {
      applyToolModePlan(viewer, plan)
      dispatch({ type: 'stopTools' })
    } else {
      dispatch({ type: 'startModifying' })
      applyToolModePlan(viewer, plan)
      viewer.activateSnapInteraction({})
      viewer.activateModifyInteraction({})
    }
  }

  const onTranslate = (): void => {
    const viewer = viewerOf()
    if (viewer === undefined) return
    logger.log('toggle translation of ROIs')
    const plan = planToolMode('translate', interaction, viewerFlags(viewer))
    if (plan === null) return
    if (viewer.isTranslateInteractionActive) {
      applyToolModePlan(viewer, plan)
      dispatch({ type: 'stopTools' })
    } else {
      dispatch({ type: 'startTranslating' })
      applyToolModePlan(viewer, plan)
      viewer.activateTranslateInteraction({})
    }
  }

  const onGoTo = (): void => {
    const viewer = viewerOf()
    if (viewer === undefined) return
    const plan = planToolMode('goTo', interaction, viewerFlags(viewer))
    if (plan !== null) applyToolModePlan(viewer, plan)
    dispatch({ type: 'openGoTo' })
  }

  const removeRois = (): void => {
    rois.removeRois()
    dispatch({ type: 'stopTools' })
  }

  const onRemove = (): void => {
    const roiCount =
      rois.selectedRoiUIDs.size > 0
        ? rois.selectedRoiUIDs.size
        : rois.visibleRoiUIDs.size
    if (roiCount === 0) {
      publishToast('No annotation was selected for removal', 'warning')
      return
    }
    if (confirmRoiRemoval) {
      dispatch({ type: 'setRoiRemovalConfirmVisible', isVisible: true })
      return
    }
    removeRois()
  }

  const onToggleRoiVisibility = (): void => {
    const viewer = viewerOf()
    if (viewer === undefined) return
    logger.log('toggle visibility of ROIs')
    if (!interaction.areRoisHidden) {
      const plan = planToolMode('hide', interaction, viewerFlags(viewer))
      if (plan !== null) applyToolModePlan(viewer, plan)
      viewer.hideROIs()
      dispatch({ type: 'hideRois' })
    } else {
      const plan = planToolMode('show', interaction, viewerFlags(viewer))
      viewer.showROIs()
      if (plan !== null) applyToolModePlan(viewer, plan)
      rois.restyleSelected()
      dispatch({ type: 'showRois' })
    }
  }

  const cancelActiveInteraction = (): void => {
    const viewer = viewerOf()
    if (viewer !== undefined) {
      const plan = planToolMode('cancel', interaction, viewerFlags(viewer))
      if (plan !== null) {
        if (interaction.isRoiDrawingActive) {
          logger.log('deactivate drawing of ROIs')
        } else if (interaction.isRoiModificationActive) {
          logger.log('deactivate modification of ROIs')
        } else if (interaction.isRoiTranslationActive) {
          logger.log('deactivate translation of ROIs')
        }
        applyToolModePlan(viewer, plan)
      }
    }
    dispatch({ type: 'cancel' })
  }

  return {
    onSelect,
    onDraw,
    onModify,
    onTranslate,
    onGoTo,
    onRemove,
    onToggleRoiVisibility,
    onGoToInputChange: (field, value) => {
      dispatch({ type: 'changeGoToInput', field, value })
    },
    onSlidePositionSelection: () => {
      const viewer = viewerOf()
      if (viewer === undefined) return
      const { target } = validateGoToInput(interaction.goToInput, goToRanges)
      if (target === undefined) return
      logger.log(
        `select slide position (${target.x}, ${target.y}) ` +
          `at ${target.magnification}x magnification`,
      )
      const pixelSpacings = Array.from(
        { length: viewer.numLevels },
        (_, level) => viewer.getPixelSpacing(level)[0],
      )
      viewer.navigate({
        position: [target.x, target.y],
        level: choosePyramidLevel(target.magnification, pixelSpacings),
      })
      if (canWriteRois) {
        const point = new dmv.scoord3d.Point({
          coordinates: [target.x, target.y, 0],
          frameOfReferenceUID: viewer.frameOfReferenceUID,
        })
        rois.addStyledRoi(new dmv.roi.ROI({ scoord3d: point }), defaultRoiStyle)
      }
      viewer.activateSelectInteraction({})
      dispatch({ type: 'closeGoTo' })
    },
    onSlidePositionSelectionCancellation: () => {
      logger.log('cancel slide position selection')
      viewerOf()?.activateSelectInteraction({})
      dispatch({ type: 'closeGoTo' })
    },
    onAnnotationConfigurationCompletion: () => {
      logger.debug('complete annotation configuration')
      const session = sessionRef.current
      const { finding, geometryType, markup } = draft
      if (
        session !== undefined &&
        geometryType !== undefined &&
        finding !== undefined
      ) {
        session.volumeViewer.setMeasurementUnit?.(measurementUnit)
        session.volumeViewer.activateDrawInteraction({
          geometryType,
          markup,
          styleOptions: drawStyleFor(session, draft, defaultRoiStyle),
        })
        dispatch({ type: 'completeAnnotationConfiguration' })
      } else {
        notifyVisualizationError('Could not complete annotation configuration')
      }
    },
    onAnnotationConfigurationCancellation: () => {
      logger.log('cancel annotation configuration')
      viewerOf()?.activateSelectInteraction({})
      dispatch({ type: 'cancelAnnotationConfiguration' })
    },
    onRoiRemovalConfirmation: () => {
      dispatch({ type: 'setRoiRemovalConfirmVisible', isVisible: false })
      removeRois()
    },
    onRoiRemovalCancellation: () => {
      dispatch({ type: 'setRoiRemovalConfirmVisible', isVisible: false })
    },
    onRoiDetailsCancellation: () => {
      logger.log('cancel ROI selection')
      dispatch({ type: 'setSelectedRoiModalVisible', isVisible: false })
    },
    onShortcut: (action) => {
      switch (action) {
        case 'cancel':
          cancelActiveInteraction()
          break
        case 'select':
          onSelect()
          break
        case 'draw':
          onDraw()
          break
        case 'modify':
          onModify()
          break
        case 'translate':
          onTranslate()
          break
        case 'remove':
          onRemove()
          break
        case 'toggleRoiVisibility':
          onToggleRoiVisibility()
          break
        case 'save':
          onSave()
          break
        case 'goTo':
          onGoTo()
          break
      }
    },
  }
}
