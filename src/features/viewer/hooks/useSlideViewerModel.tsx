/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { DEFAULT_ROI_RADIUS } from '../../../components/SlideViewer/constants'
import type { SlideViewerProps } from '../../../components/SlideViewer/types'
import { buildDefaultRoiStyle } from '../../../components/SlideViewer/utils/roiUtils'
import { hexToRgb } from '../../../utils/color'
import type { RouteComponentProps } from '../../../utils/router'
import {
  getSlideDisplayId,
  getSlideStainInfo,
} from '../../../utils/slideDisplay'
import { usePreferences } from '../../preferences'
import {
  ANNOTATION_PREFS_PREVIEW_EVENT,
  type AnnotationPrefsPreview,
  DRAW_STYLE_PREFS_PREVIEW_EVENT,
  type DrawStylePrefsPreview,
} from '../../preferences/utils/preferences'
import type { SlideViewerViewProps } from '../components/SlideViewerView'
import { useViewerPanelChrome } from '../contexts/ViewerPanelChromeContext'
import { describeStudySeries } from '../services/seriesDescription'
import { deriveActiveRoiTool } from '../utils/activeRoiTool'
import { buildAnnotationConfig } from '../utils/annotationConfig'
import { applyAnnotationViewerPrefs } from '../utils/applyAnnotationViewerPrefs'
import {
  buildDerivedLegendRows,
  type DerivedLegendRow,
} from '../utils/derivedLegend'
import {
  ALL_SERIES,
  buildSeriesOptions,
  groupBySeries,
  itemsForSeries,
} from '../utils/groupBySeries'
import { isShortcutEnabled } from '../utils/keyboardShortcuts'
import { slideAffineFromImages } from '../utils/slideCoordinates'
import {
  INITIAL_VIEWER_INTERACTION,
  viewerInteractionReducer,
} from '../utils/viewerInteraction'
import { useActiveSeriesPublisher } from './useActiveSeriesPublisher'
import { useAnnotationDraft } from './useAnnotationDraft'
import { useAnnotationGroups } from './useAnnotationGroups'
import { drawStyleFor, useAnnotationTools } from './useAnnotationTools'
import { useDmvEvents } from './useDmvEvents'
import { useHoveredRoiTooltip } from './useHoveredRoiTooltip'
import { useHeldKeys, useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useLatestRef } from './useLatestRef'
import { useNoIccProfileWarning } from './useNoIccProfileWarning'
import { useOpticalPaths } from './useOpticalPaths'
import { useParametricMaps } from './useParametricMaps'
import { usePresentationStates } from './usePresentationStates'
import { useReport } from './useReport'
import { useRois } from './useRois'
import { useSegmentations } from './useSegmentations'
import { useSlidePopulation } from './useSlidePopulation'
import { useViewerSession, useViewerSnapshot } from './useViewerSession'
import { useViewportLoading } from './useViewportLoading'

export type SlideViewerModelProps = Omit<
  SlideViewerProps,
  keyof RouteComponentProps
>

export type SlideViewerModel = SlideViewerViewProps

/**
 * Owns SlideViewer hook orchestration and returns data props for
 * `SlideViewerView`. Keeps this module free of JSX.
 */
export function useSlideViewerModel({
  slide,
  clients,
  studyInstanceUID,
  seriesInstanceUID,
  app,
  annotations,
  enableAnnotationTools,
  preload,
  user,
  selectedPresentationStateUID,
  derivedDataset,
  isLeftPanelOpen,
  onToggleLeftPanel,
  enableMemoryMonitoring,
}: SlideViewerModelProps): SlideViewerModel {
  const location = useLocation()
  const navigate = useNavigate()
  const preferences = usePreferences()
  const [annotationConfig] = useState(() => buildAnnotationConfig(annotations))
  /** Live stroke/fill from Preferences before Save */
  const [drawStylePreview, setDrawStylePreview] =
    useState<DrawStylePrefsPreview | null>(null)
  const strokeColor = drawStylePreview?.strokeColor ?? preferences.strokeColor
  const strokeWidth = drawStylePreview?.strokeWidth ?? preferences.strokeWidth
  const roiFill = drawStylePreview?.roiFill ?? preferences.roiFill
  const roiFillOpacity =
    drawStylePreview?.roiFillOpacity ?? preferences.roiFillOpacity
  const defaultRoiStyle = useMemo(
    () =>
      buildDefaultRoiStyle({
        strokeColor: hexToRgb(strokeColor),
        strokeWidth,
        radius: DEFAULT_ROI_RADIUS,
        fill: roiFill,
        fillOpacity: roiFillOpacity,
      }),
    [strokeColor, strokeWidth, roiFill, roiFillOpacity],
  )

  useEffect(() => {
    const onPreview = (event: Event): void => {
      const detail = (event as CustomEvent<DrawStylePrefsPreview>).detail
      if (detail === undefined) return
      setDrawStylePreview(detail)
    }
    window.addEventListener(DRAW_STYLE_PREFS_PREVIEW_EVENT, onPreview)
    return () => {
      window.removeEventListener(DRAW_STYLE_PREFS_PREVIEW_EVENT, onPreview)
    }
  }, [])

  /**
   * Drop stale preview when persisted preferences change (Save / Cancel).
   * Pref keys are intentional triggers; the body only clears preview state.
   */
  /** biome-ignore lint/correctness/useExhaustiveDependencies: clear on save */
  useEffect(() => {
    setDrawStylePreview(null)
  }, [
    preferences.strokeColor,
    preferences.strokeWidth,
    preferences.roiFill,
    preferences.roiFillOpacity,
  ])

  const panelChrome = useViewerPanelChrome()
  const isRightPanelOpen = panelChrome.isRightPanelOpen
  const [interaction, dispatchInteraction] = useReducer(
    viewerInteractionReducer,
    INITIAL_VIEWER_INTERACTION,
  )
  const describeSeries = (uid: string): string =>
    describeStudySeries(studyInstanceUID, uid)

  const viewer = useViewerSnapshot()
  const { sessionRef, snapshot, refreshSnapshot } = viewer

  const viewportLoading = useViewportLoading(sessionRef)
  const opticalPaths = useOpticalPaths(
    viewer,
    snapshot.isPaletteDisplayGammaCorrectionEnabled,
  )
  const presentationStates = usePresentationStates({
    sessionRef,
    clients,
    studyInstanceUID,
    requestedUID: selectedPresentationStateUID,
    location,
    navigate,
    opticalPaths,
  })
  const draft = useAnnotationDraft(annotationConfig)
  const heldKeys = useHeldKeys()
  const rois = useRois({
    viewer,
    defaultRoiStyle,
    findingCategories: annotationConfig.findingCategories,
    isShiftDown: heldKeys.isShiftDown,
    onDetailsVisibilityChange: (isVisible) =>
      dispatchInteraction({ type: 'setSelectedRoiModalVisible', isVisible }),
  })
  const roiDisplayRef = useLatestRef({
    currentVisibleRoiUIDs: rois.currentVisibleRoiUIDs,
    selectedRoiUIDs: rois.selectedRoiUIDs,
  })

  /**
   * Preferences fill/stroke apply to in-progress draw (below) and to ROIs that
   * still follow preference defaults — otherwise opacity looks "stuck".
   * The registry takes the new default for every such ROI, but only visible,
   * unselected ones are restyled on the map: hidden ROIs stay hidden and the
   * selection highlight stays until the selection changes.
   * Depend on `refreshSnapshot` (stable), not `viewer` (new object each render).
   */
  useEffect(() => {
    const session = sessionRef.current
    if (session === undefined) return
    const uids = session.roiStyles.applyPreferenceDefaults(defaultRoiStyle)
    const { currentVisibleRoiUIDs, selectedRoiUIDs } = roiDisplayRef.current
    const visibleRoiUIDs = currentVisibleRoiUIDs()
    for (const uid of uids) {
      if (visibleRoiUIDs.has(uid) && !selectedRoiUIDs.has(uid)) {
        session.volumeViewer.setROIStyle(uid, defaultRoiStyle)
      }
    }
    if (uids.length > 0) {
      refreshSnapshot()
    }
  }, [defaultRoiStyle, sessionRef, refreshSnapshot, roiDisplayRef])

  const report = useReport({
    sessionRef,
    clients,
    app,
    user,
    visibleRoiUIDs: rois.visibleRoiUIDs,
    dispatch: dispatchInteraction,
  })
  const tools = useAnnotationTools({
    sessionRef,
    interaction,
    dispatch: dispatchInteraction,
    rois,
    draft: draft.draft,
    defaultRoiStyle,
    useFindingColors: preferences.useFindingColors,
    measurementUnit: preferences.units,
    confirmRoiRemoval: preferences.confirmRoiRemoval,
    goToRanges: snapshot.goToRanges,
    onSave: report.onGenerate,
    canWriteRois: enableAnnotationTools,
  })

  /**
   * `snapshot.generation` re-applies prefs after the volume viewer is rebuilt.
   */
  /** biome-ignore lint/correctness/useExhaustiveDependencies: generation gate */
  useEffect(() => {
    const volumeViewer = sessionRef.current?.volumeViewer
    if (volumeViewer === undefined) return
    applyAnnotationViewerPrefs(volumeViewer, {
      units: preferences.units,
      markupLabelColor: preferences.markupLabelColor,
      markupLabelFontSize: preferences.markupLabelFontSize,
    })
  }, [
    preferences.units,
    preferences.markupLabelColor,
    preferences.markupLabelFontSize,
    snapshot.generation,
    sessionRef,
  ])

  /**
   * Live preview from Preferences > Annotations before Save.
   * Re-subscribe when the viewer generation changes so the handler sees a live session.
   */
  /** biome-ignore lint/correctness/useExhaustiveDependencies: generation gate */
  useEffect(() => {
    const onPreview = (event: Event): void => {
      const volumeViewer = sessionRef.current?.volumeViewer
      if (volumeViewer === undefined) return
      const detail = (event as CustomEvent<AnnotationPrefsPreview>).detail
      if (detail === undefined) return
      applyAnnotationViewerPrefs(volumeViewer, {
        units: detail.units,
        markupLabelColor: detail.markupLabelColor,
        markupLabelFontSize: detail.markupLabelFontSize,
      })
    }
    window.addEventListener(ANNOTATION_PREFS_PREVIEW_EVENT, onPreview)
    return () => {
      window.removeEventListener(ANNOTATION_PREFS_PREVIEW_EVENT, onPreview)
    }
  }, [sessionRef, snapshot.generation])

  /**
   * Draw interaction keeps the style from activate time. Re-bind when stroke
   * prefs change so the in-progress sketch matches Preferences.
   */
  useEffect(() => {
    const session = sessionRef.current
    const annotationDraft = draft.draft
    if (
      session === undefined ||
      !interaction.isRoiDrawingActive ||
      interaction.isAnnotationModalVisible ||
      annotationDraft.geometryType === undefined ||
      annotationDraft.finding === undefined
    ) {
      return
    }
    session.volumeViewer.activateDrawInteraction({
      geometryType: annotationDraft.geometryType,
      markup: annotationDraft.markup,
      styleOptions: drawStyleFor(
        session,
        annotationDraft,
        defaultRoiStyle,
        preferences.useFindingColors,
      ),
    })
  }, [
    defaultRoiStyle,
    preferences.useFindingColors,
    interaction.isRoiDrawingActive,
    interaction.isAnnotationModalVisible,
    draft.draft,
    sessionRef,
  ])
  useKeyboardShortcuts((action) => {
    if (isShortcutEnabled(action, enableAnnotationTools)) {
      tools.onShortcut(action)
    }
  })
  const annotationGroups = useAnnotationGroups(viewer, slide)
  const segmentations = useSegmentations(viewer, {
    snapshot,
    isGammaCorrectionEnabled: opticalPaths.displaySettings.gammaEnabled,
  })
  const parametricMaps = useParametricMaps(viewer)
  const hoveredRoiTooltipApi = useHoveredRoiTooltip({
    sessionRef,
    visibleRoiUIDs: rois.visibleRoiUIDs,
    visibleAnnotationGroupUIDs: annotationGroups.visibleUIDs,
    describeSeries,
  })

  useDmvEvents({
    ...viewportLoading.dmvHandlers,
    ...rois.dmvHandlers,
    ...segmentations.dmvHandlers,
    ...parametricMaps.dmvHandlers,
    ...hoveredRoiTooltipApi.dmvHandlers,
    dicommicroscopyviewer_frame_loading_ended: (frameInfo) => {
      viewportLoading.dmvHandlers.dicommicroscopyviewer_frame_loading_ended(
        frameInfo,
      )
      /**
       * DMV fetches ICC profiles after the viewer is created, so the snapshot
       * may predate them. Tiles only load once the profiles are in, and
       * `loading_ended` fires for bulk annotations only. `hasIccProfiles` is
       * sticky per generation, so only the absent-to-present change counts;
       * profiles reading [] after the ICC toggle must not refresh per tile.
       */
      const session = sessionRef.current
      const volumeViewer = session?.volumeViewer
      /** A channel's first frame sets its window slider range, once */
      const hasNewPixelRange =
        session !== undefined &&
        frameInfo.channelIdentifier !== undefined &&
        session.pixelStatistics.has(frameInfo.channelIdentifier) &&
        !Object.hasOwn(
          snapshot.opticalPathPixelRanges,
          frameInfo.channelIdentifier,
        )
      if (
        volumeViewer !== undefined &&
        (hasNewPixelRange ||
          (!snapshot.hasIccProfiles &&
            volumeViewer.getICCProfiles().length > 0))
      ) {
        viewer.refreshSnapshot()
      }
    },
    dicommicroscopyviewer_roi_drawn: (roi) => {
      const session = sessionRef.current
      if (session === undefined) return
      rois.addDrawnRoi(
        roi,
        draft.draft,
        drawStyleFor(
          session,
          draft.draft,
          defaultRoiStyle,
          preferences.useFindingColors,
        ),
      )
    },
  })

  const populateSlide = useSlidePopulation({
    clients,
    studyInstanceUID,
    derivedDataset,
    refreshSnapshot: viewer.refreshSnapshot,
    viewportLoading,
    opticalPaths,
    presentationStates,
    rois,
    annotationGroups,
    segmentations,
    parametricMaps,
    hoveredRoiTooltip: hoveredRoiTooltipApi,
  })
  const { volumeViewportRef, labelViewportRef, onViewportResize } =
    useViewerSession(viewer, {
      slide,
      clients,
      routeKey: `${location.pathname}|${studyInstanceUID}|${seriesInstanceUID}`,
      preload,
      annotationConfig,
      clustering: annotationGroups.clustering,
      gammaCorrection: opticalPaths.gammaCorrection,
      onSessionCreated: (session) => {
        applyAnnotationViewerPrefs(session.volumeViewer, {
          units: preferences.units,
          markupLabelColor: preferences.markupLabelColor,
          markupLabelFontSize: preferences.markupLabelFontSize,
        })
        dispatchInteraction({ type: 'newViewer' })
        populateSlide(session)
      },
    })
  useActiveSeriesPublisher({
    sessionRef,
    seriesInstanceUID,
    visibleAnnotationGroupUIDs: annotationGroups.visibleUIDs,
    visibleSegmentUIDs: segmentations.visibleUIDs,
    visibleMappingUIDs: parametricMaps.visibleUIDs,
    viewerGeneration: snapshot.generation,
  })
  useNoIccProfileWarning(slide)

  const [describedRoi, setDescribedRoi] = useState(rois.selectedRoi)
  if (
    interaction.isSelectedRoiModalVisible &&
    describedRoi !== rois.selectedRoi
  ) {
    setDescribedRoi(rois.selectedRoi)
  }

  const viewerKey = `${studyInstanceUID}/${seriesInstanceUID}/${snapshot.generation}`
  const derivedLegendRows = useMemo(
    () =>
      buildDerivedLegendRows({
        segments: snapshot.segments,
        segmentMetadata: snapshot.segmentMetadata,
        segmentStyles: snapshot.segmentStyles,
        visibleSegmentUIDs: segmentations.visibleUIDs,
        mappings: snapshot.mappings,
        mappingMetadata: snapshot.mappingMetadata,
        mappingStyles: snapshot.mappingStyles,
        visibleMappingUIDs: parametricMaps.visibleUIDs,
      }),
    [
      snapshot.segments,
      snapshot.segmentMetadata,
      snapshot.segmentStyles,
      segmentations.visibleUIDs,
      snapshot.mappings,
      snapshot.mappingMetadata,
      snapshot.mappingStyles,
      parametricMaps.visibleUIDs,
    ],
  )
  const onDerivedLegendVisibilityChange = (
    row: DerivedLegendRow,
    isVisible: boolean,
  ): void => {
    if (row.kind === 'segment') {
      segmentations.onVisibilityChange({
        segmentUID: row.id,
        isVisible,
      })
      return
    }
    parametricMaps.onVisibilityChange({
      mappingUID: row.id,
      isVisible,
    })
  }
  const metadata = slide.volumeImages[0]
  const slideAffine = useMemo(
    () => slideAffineFromImages(slide.volumeImages),
    [slide],
  )
  const volumeSopInstanceUIDs = useMemo(
    () => new Set(slide.volumeImages.map((image) => image.SOPInstanceUID)),
    [slide],
  )
  const groupsBySeries = groupBySeries(
    snapshot.annotationGroups,
    (group) => group.seriesInstanceUID,
  )
  const groupSeriesUID = annotationGroups.selectedSeriesUID ?? ALL_SERIES
  const segmentsBySeries = groupBySeries(
    snapshot.segments,
    (segment) =>
      snapshot.segmentMetadata[segment.uid]?.[0]?.SeriesInstanceUID ??
      'unknown',
  )
  const segmentSeriesUID = segmentations.selectedSeriesUID ?? ALL_SERIES

  return {
    isFluorescence: slide.areVolumeImagesMonochrome,
    showOverviewMap: preferences.showOverviewMap,
    cursor: viewportLoading.isLoading ? 'progress' : 'default',
    volumeViewportRef,
    labelViewportRef,
    onViewportResize,
    isRightPanelOpen,
    labelViewer: snapshot.labelViewer,
    toolbar: {
      isLeftPanelOpen: isLeftPanelOpen ?? true,
      onToggleLeftPanel,
      isRightPanelOpen,
      onToggleRightPanel: panelChrome.toggleRightPanel,
      enableAnnotationTools,
      activeTool: deriveActiveRoiTool(interaction),
      areRoisHidden: interaction.areRoisHidden,
      onSelect: tools.onSelect,
      onDraw: tools.onDraw,
      onModify: tools.onModify,
      onTranslate: tools.onTranslate,
      onRemove: tools.onRemove,
      onToggleRoiVisibility: tools.onToggleRoiVisibility,
      onSave: report.onGenerate,
      onGoTo: tools.onGoTo,
    },
    overlays: {
      viewerKey,
      getMap: snapshot.getMap,
      slideAffine,
      slideId: getSlideDisplayId(slide),
      slideDescription: getSlideStainInfo(slide),
      showSlideLabel: preferences.showSlideLabel,
      showZoomControls: preferences.showZoomControls,
      showViewportInfo: preferences.showViewportInfo,
      isWaitingForFirstImage: viewportLoading.isWaitingForFirstImage,
      derivedLegend: {
        rows: derivedLegendRows,
        onVisibilityChange: onDerivedLegendVisibilityChange,
      },
    },
    footer: {
      viewerKey,
      enableMemoryMonitoring: enableMemoryMonitoring ?? true,
      sopInstanceUIDs: volumeSopInstanceUIDs,
    },
    modals: {
      isAnnotationModalVisible: interaction.isAnnotationModalVisible,
      onAnnotationConfigurationCompletion:
        tools.onAnnotationConfigurationCompletion,
      onAnnotationConfigurationCancellation:
        tools.onAnnotationConfigurationCancellation,
      isAnnotationOkDisabled:
        draft.draft.finding === undefined ||
        draft.draft.geometryType === undefined,
      annotationConfig,
      draft: draft.draft,
      evaluationOptions: draft.evaluationOptions,
      geometryTypes: draft.geometryTypes,
      onFindingChange: draft.onFindingChange,
      onEvaluationChange: draft.onEvaluationChange,
      onEvaluationClear: draft.onEvaluationClear,
      onGeometryTypeChange: draft.onGeometryTypeChange,
      onMeasurementChange: draft.onMeasurementChange,
      isSelectedRoiModalVisible: interaction.isSelectedRoiModalVisible,
      onRoiSelectionCancellation: tools.onRoiDetailsCancellation,
      describedRoi,
      describedRoiIndex:
        describedRoi !== undefined
          ? snapshot.rois.findIndex((r) => r.uid === describedRoi.uid)
          : -1,
      measurementUnits: preferences.units,
      isGoToModalVisible: interaction.isGoToModalVisible,
      goToInput: interaction.goToInput,
      goToRanges: snapshot.goToRanges,
      onGoToInputChange: tools.onGoToInputChange,
      onSlidePositionSelection: tools.onSlidePositionSelection,
      onSlidePositionSelectionCancellation:
        tools.onSlidePositionSelectionCancellation,
      isReportModalVisible: interaction.isReportModalVisible,
      onReportVerification: report.onVerify,
      onReportCancellation: report.onCancel,
      reportDataset: report.report,
    },
    confirm: {
      open: interaction.isRoiRemovalConfirmVisible,
      title:
        rois.selectedRoiUIDs.size > 0
          ? 'Remove selected annotations?'
          : 'Remove all visible annotations?',
      onConfirm: tools.onRoiRemovalConfirmation,
      onCancel: tools.onRoiRemovalCancellation,
    },
    sidebar: {
      specimens: { metadata },
      equipment: { metadata },
      opticalPaths: {
        metadata: snapshot.opticalPathMetadata,
        opticalPaths: snapshot.opticalPaths,
        defaultOpticalPathStyles: snapshot.opticalPathStyles,
        opticalPathPixelRanges: snapshot.opticalPathPixelRanges,
        visibleOpticalPathIdentifiers: opticalPaths.visibleIdentifiers,
        activeOpticalPathIdentifiers: opticalPaths.activeIdentifiers,
        onOpticalPathVisibilityChange: opticalPaths.onVisibilityChange,
        onOpticalPathStyleChange: opticalPaths.onStyleChange,
        onOpticalPathStylePreview: opticalPaths.onStylePreview,
        onOpticalPathActivityChange: opticalPaths.onActivityChange,
        selectedPresentationStateUID: presentationStates.selectedUID,
        hasIccProfiles: snapshot.hasIccProfiles,
        displaySettings: opticalPaths.displaySettings,
        onDisplaySettingsChange: opticalPaths.onDisplaySettingsChange,
      },
      presentationStates: {
        presentationStates: presentationStates.presentationStates,
        selectedPresentationStateUID: presentationStates.selectedUID,
        onSelect: presentationStates.onSelect,
        onReset: presentationStates.onReset,
      },
      annotations: {
        enableAnnotationTools,
        rois: snapshot.rois,
        selectedRoiUIDs: rois.selectedRoiUIDs,
        visibleRoiUIDs: rois.visibleRoiUIDs,
        getRoiColor: (roi: dmv.roi.ROI) =>
          snapshot.roiColors[roi.uid] ?? 'rgb(var(--primary))',
        onSelection: rois.onSelection,
        onVisibilityChange: rois.onVisibilityChange,
        onBulkVisibilityChange: rois.onVisibilityChanges,
      },
      annotationGroups:
        snapshot.annotationGroups.length > 0
          ? {
              seriesOptions: buildSeriesOptions({
                groups: groupsBySeries,
                allLabel: 'All',
                unit: 'groups',
                describeSeries,
              }),
              selectedSeriesUID: groupSeriesUID,
              onSeriesChange: annotationGroups.onSeriesChange,
              annotationGroups: [
                ...itemsForSeries(
                  snapshot.annotationGroups,
                  groupsBySeries,
                  groupSeriesUID,
                ),
              ],
              metadata: snapshot.annotationGroupMetadata,
              onAnnotationGroupClick: annotationGroups.onClick,
              defaultAnnotationGroupStyles: snapshot.annotationGroupStyles,
              visibleAnnotationGroupUIDs: annotationGroups.visibleUIDs,
              onAnnotationGroupVisibilityChange:
                annotationGroups.onVisibilityChange,
              onBulkAnnotationGroupVisibilityChange:
                annotationGroups.onVisibilityChanges,
              onAnnotationGroupStyleChange: annotationGroups.onStyleChange,
              onAnnotationGroupStylePreview: annotationGroups.onStylePreview,
              annotationGroupMeasurementKeys: annotationGroups.measurementKeys,
              displaySettings: annotationGroups.displaySettings,
              onDisplaySettingsChange: annotationGroups.onDisplaySettingsChange,
            }
          : undefined,
      annotationCategories: {
        annotations: snapshot.annotations,
        onChange: rois.onVisibilityChanges,
        checkedAnnotationUids: rois.visibleRoiUIDs,
        onStyleChange: rois.onStylesChange,
        defaultAnnotationStyles: snapshot.annotationStyles,
      },
      segmentations:
        snapshot.segments.length > 0
          ? {
              seriesOptions: buildSeriesOptions({
                groups: segmentsBySeries,
                allLabel: `All Series (${snapshot.segments.length} segments)`,
                unit: 'segments',
                describeSeries,
              }),
              selectedSeriesUID: segmentSeriesUID,
              onSeriesChange: segmentations.onSeriesChange,
              segments: [
                ...itemsForSeries(
                  snapshot.segments,
                  segmentsBySeries,
                  segmentSeriesUID,
                ),
              ],
              metadata: snapshot.segmentMetadata,
              defaultSegmentStyles: segmentations.panelStyles,
              visibleSegmentUIDs: segmentations.visibleUIDs,
              onSegmentVisibilityChange: segmentations.onVisibilityChange,
              onBulkSegmentVisibilityChange: segmentations.onVisibilityChanges,
              onSegmentStyleChange: segmentations.onStyleChange,
              onSegmentStylePreview: segmentations.onStylePreview,
              onSegmentClick: segmentations.onClick,
              displaySettings: {
                interpolationEnabled: segmentations.isInterpolationEnabled,
              },
              onDisplaySettingsChange: segmentations.onDisplaySettingsChange,
            }
          : undefined,
      parametricMaps:
        snapshot.mappings.length > 0
          ? {
              mappings: snapshot.mappings,
              metadata: snapshot.mappingMetadata,
              defaultMappingStyles: snapshot.mappingStyles,
              visibleMappingUIDs: parametricMaps.visibleUIDs,
              onMappingVisibilityChange: parametricMaps.onVisibilityChange,
              onBulkMappingVisibilityChange: parametricMaps.onVisibilityChanges,
              onMappingStyleChange: parametricMaps.onStyleChange,
              onMappingStylePreview: parametricMaps.onStylePreview,
              displaySettings: {
                interpolationEnabled: parametricMaps.isInterpolationEnabled,
              },
              onDisplaySettingsChange: parametricMaps.onDisplaySettingsChange,
            }
          : undefined,
    },
    hoveredRoiTooltipStore: hoveredRoiTooltipApi.store,
  }
}
