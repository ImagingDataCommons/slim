import { type JSX, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { usePreferences } from '../features/preferences'
import { HoveredRoiTooltipLayer } from '../features/viewer/components/HoveredRoiTooltipLayer'
import { RoiDescription } from '../features/viewer/components/RoiDescription'
import { AnnotationCategoriesSection } from '../features/viewer/components/sections/AnnotationCategoriesSection'
import { AnnotationConfigurationFields } from '../features/viewer/components/sections/AnnotationConfigurationFields'
import { AnnotationGroupsSection } from '../features/viewer/components/sections/AnnotationGroupsSection'
import { AnnotationsSection } from '../features/viewer/components/sections/AnnotationsSection'
import { EquipmentSection } from '../features/viewer/components/sections/EquipmentSection'
import { OpticalPathsSection } from '../features/viewer/components/sections/OpticalPathsSection'
import { ParametricMapsSection } from '../features/viewer/components/sections/ParametricMapsSection'
import { PresentationStatesSection } from '../features/viewer/components/sections/PresentationStatesSection'
import { SegmentationsSection } from '../features/viewer/components/sections/SegmentationsSection'
import { SpecimensSection } from '../features/viewer/components/sections/SpecimensSection'
import { ViewerFooter } from '../features/viewer/components/ViewerFooter'
import { ViewerToolbar } from '../features/viewer/components/ViewerToolbar'
import { ViewportLoadingIndicator } from '../features/viewer/components/ViewportLoadingIndicator'
import { ViewportOverlays } from '../features/viewer/components/ViewportOverlays'
import { useActiveSeriesPublisher } from '../features/viewer/hooks/useActiveSeriesPublisher'
import { useAnnotationDraft } from '../features/viewer/hooks/useAnnotationDraft'
import { useAnnotationGroups } from '../features/viewer/hooks/useAnnotationGroups'
import {
  drawStyleFor,
  useAnnotationTools,
} from '../features/viewer/hooks/useAnnotationTools'
import { useDmvEvents } from '../features/viewer/hooks/useDmvEvents'
import { useHoveredRoiTooltip } from '../features/viewer/hooks/useHoveredRoiTooltip'
import {
  useHeldKeys,
  useKeyboardShortcuts,
} from '../features/viewer/hooks/useKeyboardShortcuts'
import { useNoIccProfileWarning } from '../features/viewer/hooks/useNoIccProfileWarning'
import { useOpticalPaths } from '../features/viewer/hooks/useOpticalPaths'
import { useParametricMaps } from '../features/viewer/hooks/useParametricMaps'
import { usePresentationStates } from '../features/viewer/hooks/usePresentationStates'
import { useReport } from '../features/viewer/hooks/useReport'
import { useRois } from '../features/viewer/hooks/useRois'
import { useSegmentations } from '../features/viewer/hooks/useSegmentations'
import { useSlidePopulation } from '../features/viewer/hooks/useSlidePopulation'
import {
  useViewerSession,
  useViewerSnapshot,
} from '../features/viewer/hooks/useViewerSession'
import { useViewportLoading } from '../features/viewer/hooks/useViewportLoading'
import { describeStudySeries } from '../features/viewer/services/seriesDescription'
import { deriveActiveRoiTool } from '../features/viewer/utils/activeRoiTool'
import { buildAnnotationConfig } from '../features/viewer/utils/annotationConfig'
import {
  ALL_SERIES,
  buildSeriesOptions,
  groupBySeries,
  itemsForSeries,
} from '../features/viewer/utils/groupBySeries'
import { buildRoiDescription } from '../features/viewer/utils/selectedRoiDescription'
import { slideAffineFromImages } from '../features/viewer/utils/slideCoordinates'
import {
  INITIAL_VIEWER_INTERACTION,
  viewerInteractionReducer,
} from '../features/viewer/utils/viewerInteraction'
import { hexToRgb } from '../utils/color'
import type { RouteComponentProps } from '../utils/router'
import { getSlideDisplayId, getSlideStainInfo } from '../utils/slideDisplay'
import { ConfirmDialog } from './ConfirmDialog'
import Report from './Report'
import { DEFAULT_ROI_RADIUS } from './SlideViewer/constants'
import SlideViewerContent from './SlideViewer/SlideViewerContent'
import SlideViewerModals from './SlideViewer/SlideViewerModals'
import SlideViewerSidebar from './SlideViewer/SlideViewerSidebar'
import type { SlideViewerProps } from './SlideViewer/types'
import { buildDefaultRoiStyle } from './SlideViewer/utils/roiUtils'

export type SlideViewerComponentProps = Omit<
  SlideViewerProps,
  keyof RouteComponentProps
>

/**
 * Interactive viewer of one digital slide (a DICOM Series of Slide
 * Microscopy images) with its annotations, segmentations, parametric maps
 * and presentation states.
 */
function SlideViewer({
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
}: SlideViewerComponentProps): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const preferences = usePreferences()
  /** Read once, like the annotation settings of the app config */
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
  useKeyboardShortcuts(tools.onShortcut)
  const annotationGroups = useAnnotationGroups(viewer, slide)
  const segmentations = useSegmentations(viewer, {
    snapshot,
    isGammaCorrectionEnabled: opticalPaths.displaySettings.gammaEnabled,
  })
  const parametricMaps = useParametricMaps(viewer)
  const hoveredRoiTooltip = useHoveredRoiTooltip({
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
    ...hoveredRoiTooltip.dmvHandlers,
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

  const onSessionCreated = useSlidePopulation({
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
    hoveredRoiTooltip,
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
      onSessionCreated,
    })
  useActiveSeriesPublisher({
    sessionRef,
    seriesInstanceUID,
    visibleAnnotationGroupUIDs: annotationGroups.visibleUIDs,
    visibleSegmentUIDs: segmentations.visibleUIDs,
    visibleMappingUIDs: parametricMaps.visibleUIDs,
  })
  useNoIccProfileWarning(slide)

  /** The details dialog keeps its last ROI while it closes */
  const [describedRoi, setDescribedRoi] = useState(rois.selectedRoi)
  if (
    interaction.isSelectedRoiModalVisible &&
    describedRoi !== rois.selectedRoi
  ) {
    setDescribedRoi(rois.selectedRoi)
  }

  const viewerKey = `${studyInstanceUID}/${seriesInstanceUID}/${snapshot.generation}`
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

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <SlideViewerContent
        toolbar={
          <ViewerToolbar
            isLeftPanelOpen={isLeftPanelOpen ?? true}
            onToggleLeftPanel={onToggleLeftPanel}
            isRightPanelOpen={isRightPanelOpen}
            onToggleRightPanel={() => setIsRightPanelOpen((isOpen) => !isOpen)}
            enableAnnotationTools={enableAnnotationTools}
            activeTool={deriveActiveRoiTool(interaction)}
            areRoisHidden={interaction.areRoisHidden}
            onDraw={tools.onDraw}
            onModify={tools.onModify}
            onTranslate={tools.onTranslate}
            onRemove={tools.onRemove}
            onToggleRoiVisibility={tools.onToggleRoiVisibility}
            onSave={report.onGenerate}
            onGoTo={tools.onGoTo}
          />
        }
        overlays={
          <>
            <ViewportOverlays
              key={viewerKey}
              getMap={snapshot.getMap}
              slideAffine={slideAffine}
              slideId={getSlideDisplayId(slide)}
              slideDescription={getSlideStainInfo(slide)}
            />
            <ViewportLoadingIndicator
              isVisible={viewportLoading.isWaitingForFirstImage}
              label="Loading slide"
            />
          </>
        }
        footer={
          <ViewerFooter
            resetKey={viewerKey}
            enableMemoryMonitoring={enableMemoryMonitoring ?? true}
            sopInstanceUIDs={volumeSopInstanceUIDs}
          />
        }
        cursor={viewportLoading.isLoading ? 'progress' : 'default'}
        isFluorescence={slide.areVolumeImagesMonochrome}
        volumeViewportRef={volumeViewportRef}
        onViewportResize={onViewportResize}
      >
        <SlideViewerModals
          isAnnotationModalVisible={interaction.isAnnotationModalVisible}
          onAnnotationConfigurationCompletion={
            tools.onAnnotationConfigurationCompletion
          }
          onAnnotationConfigurationCancellation={
            tools.onAnnotationConfigurationCancellation
          }
          isAnnotationOkDisabled={
            draft.draft.finding === undefined ||
            draft.draft.geometryType === undefined
          }
          annotationConfigurations={
            <AnnotationConfigurationFields
              findings={annotationConfig.findings}
              selectedFinding={draft.draft.finding}
              evaluationOptions={draft.evaluationOptions}
              selectedEvaluations={draft.draft.evaluations}
              geometryTypes={draft.geometryTypes}
              selectedGeometryType={draft.draft.geometryType}
              isMeasurementActive={draft.draft.markup === 'measurement'}
              onFindingChange={draft.onFindingChange}
              onEvaluationChange={draft.onEvaluationChange}
              onEvaluationClear={draft.onEvaluationClear}
              onGeometryTypeChange={draft.onGeometryTypeChange}
              onMeasurementChange={draft.onMeasurementChange}
            />
          }
          isSelectedRoiModalVisible={interaction.isSelectedRoiModalVisible}
          onRoiSelectionCancellation={tools.onRoiDetailsCancellation}
          selectedRoiInformation={
            describedRoi !== undefined ? (
              <RoiDescription
                description={buildRoiDescription(
                  describedRoi,
                  snapshot.rois.findIndex((r) => r.uid === describedRoi.uid),
                  preferences.units,
                )}
              />
            ) : undefined
          }
          isGoToModalVisible={interaction.isGoToModalVisible}
          goToInput={interaction.goToInput}
          goToRanges={snapshot.goToRanges}
          onGoToInputChange={tools.onGoToInputChange}
          onSlidePositionSelection={tools.onSlidePositionSelection}
          onSlidePositionSelectionCancellation={
            tools.onSlidePositionSelectionCancellation
          }
          isReportModalVisible={interaction.isReportModalVisible}
          onReportVerification={report.onVerify}
          onReportCancellation={report.onCancel}
          report={
            report.report !== undefined ? (
              <Report dataset={report.report} />
            ) : undefined
          }
        />
        <ConfirmDialog
          open={interaction.isRoiRemovalConfirmVisible}
          title={
            rois.selectedRoiUIDs.size > 0
              ? 'Remove selected annotations?'
              : 'Remove all visible annotations?'
          }
          description="Unsaved annotations cannot be recovered."
          confirmLabel="Remove"
          variant="destructive"
          onConfirm={tools.onRoiRemovalConfirmation}
          onCancel={tools.onRoiRemovalCancellation}
        />
      </SlideViewerContent>

      <SlideViewerSidebar
        isOpen={isRightPanelOpen}
        labelViewportRef={labelViewportRef}
        labelViewer={snapshot.labelViewer}
        specimenMenu={<SpecimensSection metadata={metadata} />}
        equipmentMenu={<EquipmentSection metadata={metadata} />}
        opticalPathMenu={
          <OpticalPathsSection
            metadata={snapshot.opticalPathMetadata}
            opticalPaths={snapshot.opticalPaths}
            defaultOpticalPathStyles={snapshot.opticalPathStyles}
            visibleOpticalPathIdentifiers={opticalPaths.visibleIdentifiers}
            activeOpticalPathIdentifiers={opticalPaths.activeIdentifiers}
            onOpticalPathVisibilityChange={opticalPaths.onVisibilityChange}
            onOpticalPathStyleChange={opticalPaths.onStyleChange}
            onOpticalPathActivityChange={opticalPaths.onActivityChange}
            selectedPresentationStateUID={presentationStates.selectedUID}
            hasIccProfiles={snapshot.hasIccProfiles}
            displaySettings={opticalPaths.displaySettings}
            onDisplaySettingsChange={opticalPaths.onDisplaySettingsChange}
          />
        }
        presentationStateMenu={
          <PresentationStatesSection
            presentationStates={presentationStates.presentationStates}
            selectedPresentationStateUID={presentationStates.selectedUID}
            onSelect={presentationStates.onSelect}
            onReset={presentationStates.onReset}
          />
        }
        annotationMenu={
          <AnnotationsSection
            enableAnnotationTools={enableAnnotationTools}
            rois={snapshot.rois}
            selectedRoiUIDs={rois.selectedRoiUIDs}
            visibleRoiUIDs={rois.visibleRoiUIDs}
            getRoiColor={(roi) =>
              snapshot.roiColors[roi.uid] ?? 'rgb(var(--primary))'
            }
            onSelection={rois.onSelection}
            onVisibilityChange={rois.onVisibilityChange}
            onBulkVisibilityChange={rois.onVisibilityChanges}
          />
        }
        annotationGroupMenu={
          snapshot.annotationGroups.length > 0 ? (
            <AnnotationGroupsSection
              seriesOptions={buildSeriesOptions({
                groups: groupsBySeries,
                allLabel: 'All',
                unit: 'groups',
                describeSeries,
              })}
              selectedSeriesUID={groupSeriesUID}
              onSeriesChange={annotationGroups.onSeriesChange}
              annotationGroups={[
                ...itemsForSeries(
                  snapshot.annotationGroups,
                  groupsBySeries,
                  groupSeriesUID,
                ),
              ]}
              metadata={snapshot.annotationGroupMetadata}
              onAnnotationGroupClick={annotationGroups.onClick}
              defaultAnnotationGroupStyles={snapshot.annotationGroupStyles}
              visibleAnnotationGroupUIDs={annotationGroups.visibleUIDs}
              onAnnotationGroupVisibilityChange={
                annotationGroups.onVisibilityChange
              }
              onBulkAnnotationGroupVisibilityChange={
                annotationGroups.onVisibilityChanges
              }
              onAnnotationGroupStyleChange={annotationGroups.onStyleChange}
              displaySettings={annotationGroups.displaySettings}
              onDisplaySettingsChange={annotationGroups.onDisplaySettingsChange}
            />
          ) : undefined
        }
        annotationCategoryMenu={
          <AnnotationCategoriesSection
            annotations={snapshot.annotations}
            onChange={rois.onVisibilityChanges}
            checkedAnnotationUids={rois.visibleRoiUIDs}
            onStyleChange={rois.onStylesChange}
            defaultAnnotationStyles={snapshot.annotationStyles}
          />
        }
        segmentationMenu={
          snapshot.segments.length > 0 ? (
            <SegmentationsSection
              seriesOptions={buildSeriesOptions({
                groups: segmentsBySeries,
                allLabel: `All Series (${snapshot.segments.length} segments)`,
                unit: 'segments',
                describeSeries,
              })}
              selectedSeriesUID={segmentSeriesUID}
              onSeriesChange={segmentations.onSeriesChange}
              segments={[
                ...itemsForSeries(
                  snapshot.segments,
                  segmentsBySeries,
                  segmentSeriesUID,
                ),
              ]}
              metadata={snapshot.segmentMetadata}
              defaultSegmentStyles={segmentations.panelStyles}
              visibleSegmentUIDs={segmentations.visibleUIDs}
              onSegmentVisibilityChange={segmentations.onVisibilityChange}
              onSegmentStyleChange={segmentations.onStyleChange}
              onSegmentClick={segmentations.onClick}
              displaySettings={{
                interpolationEnabled: segmentations.isInterpolationEnabled,
              }}
              onDisplaySettingsChange={segmentations.onDisplaySettingsChange}
            />
          ) : undefined
        }
        parametricMapMenu={
          snapshot.mappings.length > 0 ? (
            <ParametricMapsSection
              mappings={snapshot.mappings}
              metadata={snapshot.mappingMetadata}
              defaultMappingStyles={snapshot.mappingStyles}
              visibleMappingUIDs={parametricMaps.visibleUIDs}
              onMappingVisibilityChange={parametricMaps.onVisibilityChange}
              onMappingStyleChange={parametricMaps.onStyleChange}
              displaySettings={{
                interpolationEnabled: parametricMaps.isInterpolationEnabled,
              }}
              onDisplaySettingsChange={parametricMaps.onDisplaySettingsChange}
            />
          ) : undefined
        }
      />

      <HoveredRoiTooltipLayer store={hoveredRoiTooltip.store} />
    </div>
  )
}

export default SlideViewer
