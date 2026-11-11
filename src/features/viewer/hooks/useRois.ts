/** skipcq: JS-C1003 */
import type * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { startTransition, useLayoutEffect, useRef, useState } from 'react'

import {
  formatRoiRemovalMessage,
  getRoiKey,
} from '../../../components/SlideViewer/utils/roiUtils'
import type { AnnotationStyle } from '../../../types/layerStyles'
import { codedConceptKey } from '../../../utils/dicom/codedConcept'
import { logger } from '../../../utils/logger'
import type { VisibilityChange } from '../../../utils/visibility'
import { notifyVisualizationError } from '../services/derivedDataLoaders'
import type { DmvEventHandlers } from '../services/dmvEvents'
import { publishToast } from '../services/toast'
import type { ViewerSession } from '../services/viewerSession'
import type { AnnotationDraft } from '../utils/annotationDraft'
import { applyEach } from '../utils/applyEach'
import { isBulkAnnotationUid } from '../utils/derivedDataset'
import { attachDraftEvaluations } from '../utils/drawnRoi'
import { planRoiRemoval } from '../utils/roiRemoval'
import { nextSelectedRoiUIDs } from '../utils/roiSelection'
import {
  stylesForRoiSelection,
  visibleUidsAfterSelection,
} from '../utils/roiSelectionStyles'
import { annotationStyleToRoiStyle } from '../utils/roiStyleRegistry'
import { SELECTED_ROI_STYLE } from '../utils/selectedRoiStyle'
import { withItem } from '../utils/uidSets'
import {
  applyVisibilityChanges,
  removeHiddenUids,
} from '../utils/visibilityChanges'
import { applyRoiSelection, type RoiSelection } from './roiSelection'
import { type RoiVisibilityState, styleForRoi } from './roiVisibility'
import { useLatestRef } from './useLatestRef'
import type { ViewerAccess } from './useViewerSession'

type RoiStyle = dmv.viewer.ROIStyleOptions

export { SELECTED_ROI_STYLE }

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

export interface RoisApi extends RoiVisibilityState {
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
  /**
   * ROIs shown on the map now, including show/hide changes whose state
   * update is still pending in a transition
   */
  currentVisibleRoiUIDs: () => Set<string>
  dmvHandlers: RoiEventHandlers
}

/** ROIs of the viewer: which are shown, selected, and how they are styled */
export function useRois({
  viewer: { sessionRef, refreshSnapshot },
  defaultRoiStyle,
  findingCategories = {},
  isShiftDown,
  onDetailsVisibilityChange,
}: {
  viewer: ViewerAccess
  defaultRoiStyle: RoiStyle
  /** Configured Finding category (276214006) keyed by finding concept */
  findingCategories?: Readonly<Record<string, dcmjs.sr.coding.CodedConcept>>
  isShiftDown: () => boolean
  onDetailsVisibilityChange: (isVisible: boolean) => void
}): RoisApi {
  const [state, setState] = useState<RoiVisibilityState>(() => ({
    selectedRoiUIDs: new Set(),
    visibleRoiUIDs: new Set(),
    selectedRoi: undefined,
  }))
  const { selectedRoiUIDs, visibleRoiUIDs } = state

  /**
   * onVisibilityChanges styles the map at once but commits visibleRoiUIDs in
   * a transition. Pending changes are kept here until that commit so code
   * styling ROIs in between (selection, preference defaults) sees the map.
   */
  const committedVisibleRef = useLatestRef(visibleRoiUIDs)
  const pendingVisibilityRef = useRef(new Map<string, boolean>())
  useLayoutEffect(() => {
    for (const [uid, isVisible] of pendingVisibilityRef.current) {
      if (visibleRoiUIDs.has(uid) === isVisible) {
        pendingVisibilityRef.current.delete(uid)
      }
    }
  }, [visibleRoiUIDs])
  const currentVisibleRoiUIDs = (): Set<string> => {
    const visible = new Set(committedVisibleRef.current)
    for (const [uid, isVisible] of pendingVisibilityRef.current) {
      if (isVisible) visible.add(uid)
      else visible.delete(uid)
    }
    return visible
  }

  const registerRoi = (
    session: ViewerSession,
    roi: dmv.roi.ROI,
    key: string | undefined = getRoiKey(roi),
  ): void => {
    session.roiStyles.registerAnnotationStyle(roi.uid, key, {
      radius: defaultRoiStyle.image?.circle?.radius,
      strokeWidth: defaultRoiStyle.stroke?.width,
    })
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

  const select = (session: ViewerSession, selection: RoiSelection): void => {
    applyRoiSelection(
      session,
      selection,
      currentVisibleRoiUIDs(),
      defaultRoiStyle,
      setState,
      refreshSnapshot,
    )
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
          volumeViewer.setROIStyle(
            roi.uid,
            styleForRoi(session, roi, defaultRoiStyle),
          )
          return { uid: roi.uid, isVisible }
        }
        logger.log(`hide ROI ${uid}`)
        volumeViewer.setROIStyle(uid, {})
        return { uid, isVisible }
      },
      (applied) => {
        if (applied.length === 0) return
        for (const { uid, isVisible } of applied) {
          pendingVisibilityRef.current.set(uid, isVisible)
        }
        startTransition(() => {
          setState((current) => ({
            ...current,
            visibleRoiUIDs: applyVisibilityChanges(
              current.visibleRoiUIDs,
              applied,
            ),
            selectedRoiUIDs: removeHiddenUids(current.selectedRoiUIDs, applied),
          }))
        })
        refreshSnapshot()
      },
    )
  }

  return {
    ...state,
    currentVisibleRoiUIDs,
    reset: () => {
      pendingVisibilityRef.current.clear()
      setState((current) => ({
        ...current,
        visibleRoiUIDs: new Set(),
        selectedRoiUIDs: new Set(),
        selectedRoi: undefined,
      }))
    },
    registerRoi: (session, roi) => {
      registerRoi(session, roi)
    },
    addStyledRoi,
    addDrawnRoi: (roi, draft, style) => {
      const findingKey =
        draft.finding !== undefined ? codedConceptKey(draft.finding) : undefined
      const findingCategory =
        findingKey !== undefined ? findingCategories[findingKey] : undefined
      if (
        roi === undefined ||
        !attachDraftEvaluations(roi, draft, findingCategory)
      ) {
        logger.debug(`could not add ROI "${roi?.uid}"`)
        return
      }
      logger.debug(`add ROI "${roi.uid}"`)
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
      const { styles, selectedVisibleUIDs } = stylesForRoiSelection({
        rois: volumeViewer.getAllROIs(),
        selectedRoiUIDs: selection.selectedRoiUIDs,
        visibleRoiUIDs: currentVisibleRoiUIDs(),
        selectedStyle: SELECTED_ROI_STYLE,
        styleForRoi: (roi) => styleForRoi(session, roi, defaultRoiStyle),
      })
      for (const { uid: roiUid, style } of styles) {
        volumeViewer.setROIStyle(roiUid, style)
      }
      setState((current) => ({
        ...current,
        ...selection,
        visibleRoiUIDs: visibleUidsAfterSelection(
          current.visibleRoiUIDs,
          selectedVisibleUIDs,
        ),
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
      const style = annotationStyleToRoiStyle(styleOptions, {
        radius: defaultRoiStyle.image?.circle?.radius,
        strokeWidth: defaultRoiStyle.stroke?.width,
      })
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
      /** A toggle still in its transition counts as already applied */
      const plan = planRoiRemoval(selectedRoiUIDs, currentVisibleRoiUIDs())
      for (const uid of plan.removedUIDs) {
        logger.log(`remove ROI "${uid}"`)
        volumeViewer.removeROI(uid)
        session.roiStyles.forget(uid)
        pendingVisibilityRef.current.delete(uid)
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
            selectedRoiUIDs: nextSelectedRoiUIDs(
              selectedRoiUIDs,
              payload.uid,
              isShiftDown(),
            ),
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
