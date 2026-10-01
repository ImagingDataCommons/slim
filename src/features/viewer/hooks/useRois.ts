/** skipcq: JS-C1003 */
import * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useState } from 'react'

import {
  SELECTION_FILL_COLOR,
  SELECTION_STROKE_COLOR,
} from '../../../components/SlideViewer/constants'
import {
  formatRoiRemovalMessage,
  getRoiKey,
} from '../../../components/SlideViewer/utils/roiUtils'
import type { AnnotationStyle } from '../../../types/layerStyles'
import { logger } from '../../../utils/logger'
import type { VisibilityChange } from '../../../utils/visibility'
import { notifyVisualizationError } from '../services/derivedDataLoaders'
import type { DmvEventHandlers } from '../services/dmvEvents'
import { publishToast } from '../services/toast'
import type { ViewerSession } from '../services/viewerSession'
import type { AnnotationDraft } from '../utils/annotationDraft'
import { applyEach } from '../utils/applyEach'
import { isBulkAnnotationUid } from '../utils/derivedDataset'
import { planRoiRemoval } from '../utils/roiRemoval'
import { nextSelectedRoiUIDs } from '../utils/roiSelection'
import { annotationStyleToRoiStyle } from '../utils/roiStyleRegistry'
import { withItem } from '../utils/uidSets'
import {
  applyVisibilityChanges,
  removeHiddenUids,
} from '../utils/visibilityChanges'
import type { ViewerAccess } from './useViewerSession'

type RoiStyle = dmv.viewer.ROIStyleOptions

export const SELECTED_ROI_STYLE: RoiStyle = {
  stroke: { color: [...SELECTION_STROKE_COLOR, 1], width: 3 },
  fill: { color: [...SELECTION_FILL_COLOR, 0.5] },
  image: {
    circle: {
      radius: 5,
      fill: { color: [...SELECTION_STROKE_COLOR, 1] },
    },
  },
}

interface RoiSelection {
  selectedRoiUIDs: Set<string>
  /** Last selected or double-clicked ROI, described in the details dialog */
  selectedRoi?: dmv.roi.ROI
}

interface RoiState extends RoiSelection {
  visibleRoiUIDs: Set<string>
}

type RoiEventHandlers = Required<
  Pick<
    DmvEventHandlers,
    | 'dicommicroscopyviewer_roi_selected'
    | 'dicommicroscopyviewer_viewport_clicked'
    | 'dicommicroscopyviewer_roi_double_clicked'
    | 'dicommicroscopyviewer_roi_modified'
    | 'dicommicroscopyviewer_roi_removed'
  >
>

export interface RoisApi extends RoiState {
  /** New viewers start with no ROI shown */
  reset: () => void
  /** Give an ROI loaded from a report its list style */
  registerRoi: (session: ViewerSession, roi: dmv.roi.ROI) => void
  /** Add a user-created ROI with `style` and show it */
  addStyledRoi: (roi: dmv.roi.ROI, style: RoiStyle) => void
  /** Attach the draft's finding and evaluations to a drawn ROI and add it */
  addDrawnRoi: (
    roi: dmv.roi.ROI | undefined,
    draft: AnnotationDraft,
    style: RoiStyle,
  ) => void
  showAll: (session: ViewerSession) => void
  onSelection: (uid: string) => void
  onVisibilityChange: (change: { roiUID: string; isVisible: boolean }) => void
  onVisibilityChanges: (changes: VisibilityChange[]) => void
  onStylesChange: (change: {
    uids: string[]
    styleOptions: AnnotationStyle
  }) => void
  /** Remove the selected ROIs, or all visible ones when none is selected */
  removeRois: () => void
  /** Re-apply the selection style, after ROIs were shown again */
  restyleSelected: () => void
  dmvHandlers: RoiEventHandlers
}

const FINDING_NAME = {
  value: '121071',
  meaning: 'Finding',
  schemeDesignator: 'DCM',
}

/** ROIs of the viewer: which are shown, selected, and how they are styled */
export function useRois({
  viewer: { sessionRef, refreshSnapshot },
  defaultRoiStyle,
  isShiftDown,
  onDetailsVisibilityChange,
}: {
  viewer: ViewerAccess
  defaultRoiStyle: RoiStyle
  isShiftDown: () => boolean
  onDetailsVisibilityChange: (isVisible: boolean) => void
}): RoisApi {
  const [state, setState] = useState<RoiState>(() => ({
    selectedRoiUIDs: new Set(),
    visibleRoiUIDs: new Set(),
    selectedRoi: undefined,
  }))
  const { selectedRoiUIDs, visibleRoiUIDs } = state

  const styleForRoi = (session: ViewerSession, roi: dmv.roi.ROI): RoiStyle =>
    session.roiStyles.styleForRoi(roi.uid, getRoiKey(roi), defaultRoiStyle)

  const registerRoi = (
    session: ViewerSession,
    roi: dmv.roi.ROI,
    key: string | undefined = getRoiKey(roi),
  ): void => {
    session.roiStyles.registerAnnotationStyle(
      roi.uid,
      key,
      defaultRoiStyle.stroke?.width,
    )
  }

  const selectionOf = (
    session: ViewerSession,
    uid: string | undefined,
  ): RoiSelection => {
    const roi = uid !== undefined ? session.volumeViewer.getROI(uid) : undefined
    if (roi === undefined) {
      return { selectedRoiUIDs: new Set(), selectedRoi: undefined }
    }
    logger.debug(`selected ROI "${roi.uid}"`)
    return {
      selectedRoiUIDs: nextSelectedRoiUIDs(
        selectedRoiUIDs,
        roi.uid,
        isShiftDown(),
      ),
      selectedRoi: roi,
    }
  }

  /** Select, then give visible unselected ROIs back their own style */
  const select = (session: ViewerSession, selection: RoiSelection): void => {
    setState((current) => ({ ...current, ...selection }))
    for (const roi of session.volumeViewer.getAllROIs()) {
      if (
        selection.selectedRoiUIDs.has(roi.uid) ||
        !visibleRoiUIDs.has(roi.uid)
      ) {
        continue
      }
      session.volumeViewer.setROIStyle(roi.uid, styleForRoi(session, roi))
    }
    refreshSnapshot()
  }

  const addStyledRoi = (roi: dmv.roi.ROI, style: RoiStyle): void => {
    const session = sessionRef.current
    if (session === undefined) return
    const key = getRoiKey(roi)
    session.roiStyles.recordAddedRoi(roi.uid, key, style)
    session.volumeViewer.addROI(roi, style)
    registerRoi(session, roi, key)
    setState((current) => ({
      ...current,
      visibleRoiUIDs: withItem(current.visibleRoiUIDs, roi.uid),
    }))
    refreshSnapshot()
  }

  const onVisibilityChanges = (changes: VisibilityChange[]): void => {
    const session = sessionRef.current
    if (session === undefined) return
    const { volumeViewer } = session
    applyEach(
      changes,
      ({ uid, isVisible }): VisibilityChange => {
        if (isVisible) {
          logger.log(`show ROI ${uid}`)
          const roi = volumeViewer.getROI(uid)
          volumeViewer.setROIStyle(roi.uid, styleForRoi(session, roi))
          return { uid: roi.uid, isVisible }
        }
        logger.log(`hide ROI ${uid}`)
        volumeViewer.setROIStyle(uid, {})
        return { uid, isVisible }
      },
      (applied) => {
        if (applied.length === 0) return
        setState((current) => ({
          ...current,
          visibleRoiUIDs: applyVisibilityChanges(
            current.visibleRoiUIDs,
            applied,
          ),
          selectedRoiUIDs: removeHiddenUids(current.selectedRoiUIDs, applied),
        }))
        refreshSnapshot()
      },
    )
  }

  return {
    ...state,
    reset: () => {
      setState((current) => ({ ...current, visibleRoiUIDs: new Set() }))
    },
    registerRoi: (session, roi) => {
      registerRoi(session, roi)
    },
    addStyledRoi,
    addDrawnRoi: (roi, draft, style) => {
      if (roi === undefined || draft.finding === undefined) {
        logger.debug(`could not add ROI "${roi?.uid}"`)
        return
      }
      logger.debug(`add ROI "${roi.uid}"`)
      roi.addEvaluation(
        new dcmjs.sr.valueTypes.CodeContentItem({
          name: new dcmjs.sr.coding.CodedConcept(FINDING_NAME),
          value: draft.finding,
          relationshipType: 'CONTAINS',
        }),
      )
      for (const evaluation of draft.evaluations) {
        roi.addEvaluation(
          new dcmjs.sr.valueTypes.CodeContentItem({
            name: evaluation.name,
            value: evaluation.value,
            relationshipType: 'CONTAINS',
          }),
        )
      }
      addStyledRoi(roi, style)
    },
    showAll: (session) => {
      /**
       * ROIs carry no series UID, so show every ROI; only those in this
       * frame of reference were loaded.
       */
      onVisibilityChanges(
        session.volumeViewer
          .getAllROIs()
          .map((roi) => ({ uid: roi.uid, isVisible: true })),
      )
    },
    onSelection: (uid) => {
      const session = sessionRef.current
      if (session === undefined) return
      const { volumeViewer } = session
      volumeViewer.clearSelections()
      const selection = selectionOf(session, uid)
      const selectedVisibleUIDs: string[] = []
      for (const roi of volumeViewer.getAllROIs()) {
        let style: RoiStyle = {}
        if (selection.selectedRoiUIDs.has(roi.uid)) {
          style = SELECTED_ROI_STYLE
          selectedVisibleUIDs.push(roi.uid)
        } else if (visibleRoiUIDs.has(roi.uid)) {
          style = styleForRoi(session, roi)
        }
        volumeViewer.setROIStyle(roi.uid, style)
      }
      setState((current) => ({
        ...current,
        ...selection,
        visibleRoiUIDs: selectedVisibleUIDs.every((uid) =>
          current.visibleRoiUIDs.has(uid),
        )
          ? current.visibleRoiUIDs
          : new Set([...current.visibleRoiUIDs, ...selectedVisibleUIDs]),
      }))
      refreshSnapshot()
    },
    onVisibilityChange: ({ roiUID, isVisible }) => {
      onVisibilityChanges([{ uid: roiUID, isVisible }])
    },
    onVisibilityChanges,
    onStylesChange: ({ uids, styleOptions }) => {
      const session = sessionRef.current
      if (session === undefined) return
      const style = annotationStyleToRoiStyle(
        styleOptions,
        defaultRoiStyle.stroke?.width,
      )
      applyEach(
        uids,
        (uid) => {
          logger.log(`change style of ROI ${uid}`)
          try {
            session.roiStyles.applyAnnotationStyle(
              uid,
              getRoiKey(session.volumeViewer.getROI(uid)),
              styleOptions,
              style,
            )
            session.volumeViewer.setROIStyle(uid, style)
          } catch (error) {
            notifyVisualizationError('Failed to change style of ROI.')
            throw error
          }
          return uid
        },
        (styledUids) => {
          setState((current) =>
            styledUids.every((uid) => current.visibleRoiUIDs.has(uid))
              ? current
              : {
                  ...current,
                  visibleRoiUIDs: applyVisibilityChanges(
                    current.visibleRoiUIDs,
                    styledUids.map((uid) => ({ uid, isVisible: true })),
                  ),
                },
          )
          refreshSnapshot()
        },
      )
    },
    removeRois: () => {
      const session = sessionRef.current
      if (session === undefined) return
      const { volumeViewer } = session
      volumeViewer.deactivateDrawInteraction()
      volumeViewer.deactivateSnapInteraction()
      volumeViewer.deactivateTranslateInteraction()
      volumeViewer.deactivateModifyInteraction()
      const plan = planRoiRemoval(selectedRoiUIDs, visibleRoiUIDs)
      for (const uid of plan.removedUIDs) {
        logger.log(`remove ROI "${uid}"`)
        volumeViewer.removeROI(uid)
        session.roiStyles.forget(uid)
      }
      publishToast(formatRoiRemovalMessage(plan.removedUIDs.length), 'success')
      setState((current) => ({
        ...current,
        selectedRoiUIDs: plan.selectedRoiUIDs,
        visibleRoiUIDs: plan.visibleRoiUIDs,
      }))
      volumeViewer.activateSelectInteraction({})
      refreshSnapshot()
    },
    restyleSelected: () => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      for (const uid of selectedRoiUIDs) {
        viewer.setROIStyle(uid, SELECTED_ROI_STYLE)
      }
      refreshSnapshot()
    },
    dmvHandlers: {
      dicommicroscopyviewer_roi_selected: (payload) => {
        const session = sessionRef.current
        if (session === undefined) return
        if (
          payload !== null &&
          payload !== undefined &&
          'uid' in payload &&
          'scoord3d' in payload
        ) {
          select(session, {
            selectedRoiUIDs: isShiftDown()
              ? new Set([...selectedRoiUIDs, payload.uid])
              : new Set([payload.uid]),
            selectedRoi: payload,
          })
        } else {
          select(session, selectionOf(session, payload?.uid))
        }
      },
      dicommicroscopyviewer_viewport_clicked: (payload) => {
        const session = sessionRef.current
        if (session === undefined) return
        if ((payload?.rois ?? []).length !== 0) return
        session.volumeViewer.clearSelections()
        select(session, selectionOf(session, undefined))
      },
      dicommicroscopyviewer_roi_double_clicked: (roi) => {
        const session = sessionRef.current
        if (session === undefined) return
        if (roi === null || roi === undefined) {
          setState((current) => ({ ...current, selectedRoi: undefined }))
          onDetailsVisibilityChange(false)
          return
        }
        const groupUids = session.volumeViewer
          .getAllAnnotationGroups()
          .map((group) => String(group.uid))
        /** Bulk annotations have no ROI details to show */
        if (isBulkAnnotationUid(roi.uid, groupUids)) return
        setState((current) => ({ ...current, selectedRoi: roi }))
        onDetailsVisibilityChange(true)
      },
      dicommicroscopyviewer_roi_modified: () => {
        /** New Set identity re-renders the annotation list */
        setState((current) => ({
          ...current,
          visibleRoiUIDs: new Set(current.visibleRoiUIDs),
        }))
        refreshSnapshot()
      },
      dicommicroscopyviewer_roi_removed: (roi) => {
        logger.debug(`removed ROI "${roi?.uid}"`)
      },
    },
  }
}
