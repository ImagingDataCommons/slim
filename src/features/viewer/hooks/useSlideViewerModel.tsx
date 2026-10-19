/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useMemo, useReducer, useState } from 'react'
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
import type { SlideViewerViewProps } from '../components/SlideViewerView'
import { describeStudySeries } from '../services/seriesDescription'
import { deriveActiveRoiTool } from '../utils/activeRoiTool'
import { buildAnnotationConfig } from '../utils/annotationConfig'
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
import { useNoIccProfileWarning } from './useNoIccProfileWarning'
import { useOpticalPaths } from './useOpticalPaths'
import { useParametricMaps } from './useParametricMaps'
import { usePresentationStates } from './usePresentationStates'
import { useReport } from './useReport'
import { useRois } from './useRois'
import { useSegmentations } from './useSegmentations'
import { useSlidePopulation } from './useSlidePopulation'
import { useSuppressDMVDerivedLegend } from './useSuppressDMVDerivedLegend'
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
  const { strokeColor, strokeWidth } = preferences
  const defaultRoiStyle = useMemo(
    () =>
      buildDefaultRoiStyle({
        strokeColor: hexToRgb(strokeColor),
        strokeWidth,
        radius: DEFAULT_ROI_RADIUS,
      }),
    [strokeColor, strokeWidth],
  )
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true)
  const [interaction, dispatchInteraction] = useReducer(
    viewerInteractionReducer,
    INITIAL_VIEWER_INTERACTION,
  )
  const describeSeries = (uid: string): string =>
    describeStudySeries(studyInstanceUID, uid)

  const viewer = useViewerSnapshot()
  const { sessionRef, snapshot } = viewer
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
    isShiftDown: heldKeys.isShiftDown,
    onDetailsVisibilityChange: (isVisible) =>
      dispatchInteraction({ type: 'setSelectedRoiModalVisible', isVisible }),
  })
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
    confirmRoiRemoval: preferences.confirmRoiRemoval,
    goToRanges: snapshot.goToRanges,
    onSave: report.onGenerate,
  })
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
       * `loading_ended` fires for bulk annotations only.
       */
      const volumeViewer = sessionRef.current?.volumeViewer
      if (
        volumeViewer !== undefined &&
        volumeViewer.getICCProfiles().length > 0 !== snapshot.hasIccProfiles
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
        drawStyleFor(session, draft.draft, defaultRoiStyle),
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
      defaultRoiStyle,
      clustering: annotationGroups.clustering,
      gammaCorrection: opticalPaths.gammaCorrection,
      onSessionCreated: (session) => {
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
  useSuppressDMVDerivedLegend({
    getLegendRoot: () => {
      const overlay = (
        sessionRef.current?.volumeViewer as
          | { segmentOverlay?: { getElement: () => HTMLElement } }
          | undefined
      )?.segmentOverlay
      return overlay?.getElement()
    },
    viewerKey,
  })
  const derivedLegendRows = useMemo(
    () =>
      buildDerivedLegendRows({
        segments: snapshot.segments,
        segmentMetadata: snapshot.segmentMetadata,
        segmentStyles: snapshot.segmentStyles,
        visibleSegmentUIDs: segmentations.visibleUIDs,
        mappings: snapshot.mappings,
        mappingStyles: snapshot.mappingStyles,
        visibleMappingUIDs: parametricMaps.visibleUIDs,
      }),
    [
      snapshot.segments,
      snapshot.segmentMetadata,
      snapshot.segmentStyles,
      segmentations.visibleUIDs,
      snapshot.mappings,
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
      onToggleRightPanel: () => setIsRightPanelOpen((isOpen) => !isOpen),
      enableAnnotationTools,
      activeTool: deriveActiveRoiTool(interaction),
      areRoisHidden: interaction.areRoisHidden,
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
        visibleOpticalPathIdentifiers: opticalPaths.visibleIdentifiers,
        activeOpticalPathIdentifiers: opticalPaths.activeIdentifiers,
        onOpticalPathVisibilityChange: opticalPaths.onVisibilityChange,
        onOpticalPathStyleChange: opticalPaths.onStyleChange,
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
              onSegmentStyleChange: segmentations.onStyleChange,
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
              onMappingStyleChange: parametricMaps.onStyleChange,
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
