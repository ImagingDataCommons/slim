/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type { ComponentProps, JSX } from 'react'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import Report from '../../../components/Report'
import SlideViewerContent from '../../../components/SlideViewer/SlideViewerContent'
import SlideViewerModals from '../../../components/SlideViewer/SlideViewerModals'
import SlideViewerSidebar from '../../../components/SlideViewer/SlideViewerSidebar'

import type { EvaluationOptions } from '../../../components/SlideViewer/types'
import type { MeasurementUnit } from '../../preferences'
import { useViewerPanelChrome } from '../contexts/ViewerPanelChromeContext'
import type { AnnotationConfig } from '../utils/annotationConfig'
import type { AnnotationDraft } from '../utils/annotationDraft'
import type { GoToField, GoToInput, GoToRanges } from '../utils/goTo'
import { buildRoiDescription } from '../utils/selectedRoiDescription'
import { HoveredRoiTooltipLayer } from './HoveredRoiTooltipLayer'
import { OverlayPanel } from './OverlayPanel'
import { RoiDescription } from './RoiDescription'
import { AnnotationCategoriesSection } from './sections/AnnotationCategoriesSection'
import { AnnotationConfigurationFields } from './sections/AnnotationConfigurationFields'
import { AnnotationGroupsSection } from './sections/AnnotationGroupsSection'
import { AnnotationsSection } from './sections/AnnotationsSection'
import { EquipmentSection } from './sections/EquipmentSection'
import { OpticalPathsSection } from './sections/OpticalPathsSection'
import { ParametricMapsSection } from './sections/ParametricMapsSection'
import { PresentationStatesSection } from './sections/PresentationStatesSection'
import { SegmentationsSection } from './sections/SegmentationsSection'
import { SpecimensSection } from './sections/SpecimensSection'
import {
  ViewerChromeFooter,
  type ViewerChromeFooterProps,
  ViewerChromeOverlays,
  type ViewerChromeOverlaysProps,
  ViewerChromeToolbar,
  type ViewerChromeToolbarProps,
} from './ViewerChrome'

export interface SlideViewerViewModals {
  isAnnotationModalVisible: boolean
  onAnnotationConfigurationCompletion: () => void
  onAnnotationConfigurationCancellation: () => void
  isAnnotationOkDisabled: boolean
  annotationConfig: AnnotationConfig
  draft: AnnotationDraft
  evaluationOptions: readonly EvaluationOptions[]
  geometryTypes: readonly string[]
  onFindingChange: ComponentProps<
    typeof AnnotationConfigurationFields
  >['onFindingChange']
  onEvaluationChange: ComponentProps<
    typeof AnnotationConfigurationFields
  >['onEvaluationChange']
  onEvaluationClear: ComponentProps<
    typeof AnnotationConfigurationFields
  >['onEvaluationClear']
  onGeometryTypeChange: ComponentProps<
    typeof AnnotationConfigurationFields
  >['onGeometryTypeChange']
  onMeasurementChange: ComponentProps<
    typeof AnnotationConfigurationFields
  >['onMeasurementChange']
  isSelectedRoiModalVisible: boolean
  onRoiSelectionCancellation: () => void
  describedRoi: dmv.roi.ROI | undefined
  describedRoiIndex: number
  measurementUnits: MeasurementUnit
  isGoToModalVisible: boolean
  goToInput: GoToInput
  goToRanges: GoToRanges
  onGoToInputChange: (field: GoToField, value: string) => void
  onSlidePositionSelection: () => void
  onSlidePositionSelectionCancellation: () => void
  isReportModalVisible: boolean
  onReportVerification: () => void
  onReportCancellation: () => void
  reportDataset: dmv.metadata.Comprehensive3DSR | undefined
}

export interface SlideViewerViewConfirm {
  open: boolean
  title: string
  onConfirm: () => void
  onCancel: () => void
}

export interface SlideViewerViewSidebar {
  specimens: ComponentProps<typeof SpecimensSection>
  equipment: ComponentProps<typeof EquipmentSection>
  opticalPaths: ComponentProps<typeof OpticalPathsSection>
  presentationStates: ComponentProps<typeof PresentationStatesSection>
  annotations: ComponentProps<typeof AnnotationsSection>
  annotationGroups?: ComponentProps<typeof AnnotationGroupsSection>
  annotationCategories: ComponentProps<typeof AnnotationCategoriesSection>
  segmentations?: ComponentProps<typeof SegmentationsSection>
  parametricMaps?: ComponentProps<typeof ParametricMapsSection>
}

export interface SlideViewerViewProps {
  isFluorescence: boolean
  showOverviewMap: boolean
  cursor: 'progress' | 'default'
  volumeViewportRef: ComponentProps<
    typeof SlideViewerContent
  >['volumeViewportRef']
  labelViewportRef: ComponentProps<
    typeof SlideViewerSidebar
  >['labelViewportRef']
  onViewportResize: () => void
  isRightPanelOpen: boolean
  labelViewer: dmv.viewer.LabelImageViewer | undefined
  toolbar: ViewerChromeToolbarProps
  overlays: ViewerChromeOverlaysProps
  footer: ViewerChromeFooterProps
  modals: SlideViewerViewModals
  confirm: SlideViewerViewConfirm
  sidebar: SlideViewerViewSidebar
  hoveredRoiTooltipStore: ComponentProps<typeof HoveredRoiTooltipLayer>['store']
}

/** Presentational shell: builds chrome, modals and sidebar from model data. */
export function SlideViewerView({
  isFluorescence,
  showOverviewMap,
  cursor,
  volumeViewportRef,
  labelViewportRef,
  onViewportResize,
  isRightPanelOpen,
  labelViewer,
  toolbar,
  overlays,
  footer,
  modals,
  confirm,
  sidebar,
  hoveredRoiTooltipStore,
}: SlideViewerViewProps): JSX.Element {
  const selectedRoiInformation =
    modals.describedRoi !== undefined ? (
      <RoiDescription
        description={buildRoiDescription(
          modals.describedRoi,
          modals.describedRoiIndex,
          modals.measurementUnits,
        )}
      />
    ) : undefined

  const { overlayPanels, setRightPanelOpen } = useViewerPanelChrome()
  const slideSidebar = (
    <SlideViewerSidebar
      isOpen={overlayPanels || isRightPanelOpen}
      labelViewportRef={labelViewportRef}
      labelViewer={labelViewer}
      className={overlayPanels ? 'min-h-0 w-full flex-1 border-0' : undefined}
      specimenMenu={<SpecimensSection {...sidebar.specimens} />}
      equipmentMenu={<EquipmentSection {...sidebar.equipment} />}
      opticalPathMenu={<OpticalPathsSection {...sidebar.opticalPaths} />}
      presentationStateMenu={
        <PresentationStatesSection {...sidebar.presentationStates} />
      }
      annotationMenu={<AnnotationsSection {...sidebar.annotations} />}
      annotationGroupMenu={
        sidebar.annotationGroups === undefined ? undefined : (
          <AnnotationGroupsSection {...sidebar.annotationGroups} />
        )
      }
      annotationCategoryMenu={
        <AnnotationCategoriesSection {...sidebar.annotationCategories} />
      }
      segmentationMenu={
        sidebar.segmentations === undefined ? undefined : (
          <SegmentationsSection {...sidebar.segmentations} />
        )
      }
      parametricMapMenu={
        sidebar.parametricMaps === undefined ? undefined : (
          <ParametricMapsSection {...sidebar.parametricMaps} />
        )
      }
    />
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <SlideViewerContent
        toolbar={
          overlayPanels ? undefined : <ViewerChromeToolbar {...toolbar} />
        }
        overlays={<ViewerChromeOverlays {...overlays} />}
        footer={
          overlayPanels ? (
            <ViewerChromeToolbar
              {...toolbar}
              variant="overlay"
              status={<ViewerChromeFooter {...footer} compact />}
            />
          ) : (
            <ViewerChromeFooter {...footer} />
          )
        }
        cursor={cursor}
        isFluorescence={isFluorescence}
        showOverviewMap={showOverviewMap}
        volumeViewportRef={volumeViewportRef}
        onViewportResize={onViewportResize}
      >
        <SlideViewerModals
          isAnnotationModalVisible={modals.isAnnotationModalVisible}
          onAnnotationConfigurationCompletion={
            modals.onAnnotationConfigurationCompletion
          }
          onAnnotationConfigurationCancellation={
            modals.onAnnotationConfigurationCancellation
          }
          isAnnotationOkDisabled={modals.isAnnotationOkDisabled}
          annotationConfigurations={
            <AnnotationConfigurationFields
              findings={modals.annotationConfig.findings}
              selectedFinding={modals.draft.finding}
              evaluationOptions={modals.evaluationOptions}
              selectedEvaluations={modals.draft.evaluations}
              geometryTypes={modals.geometryTypes}
              selectedGeometryType={modals.draft.geometryType}
              isMeasurementActive={modals.draft.markup === 'measurement'}
              onFindingChange={modals.onFindingChange}
              onEvaluationChange={modals.onEvaluationChange}
              onEvaluationClear={modals.onEvaluationClear}
              onGeometryTypeChange={modals.onGeometryTypeChange}
              onMeasurementChange={modals.onMeasurementChange}
            />
          }
          isSelectedRoiModalVisible={modals.isSelectedRoiModalVisible}
          onRoiSelectionCancellation={modals.onRoiSelectionCancellation}
          selectedRoiInformation={selectedRoiInformation}
          isGoToModalVisible={modals.isGoToModalVisible}
          goToInput={modals.goToInput}
          goToRanges={modals.goToRanges}
          onGoToInputChange={modals.onGoToInputChange}
          onSlidePositionSelection={modals.onSlidePositionSelection}
          onSlidePositionSelectionCancellation={
            modals.onSlidePositionSelectionCancellation
          }
          isReportModalVisible={modals.isReportModalVisible}
          onReportVerification={modals.onReportVerification}
          onReportCancellation={modals.onReportCancellation}
          report={
            modals.reportDataset !== undefined ? (
              <Report dataset={modals.reportDataset} />
            ) : undefined
          }
        />
        <ConfirmDialog
          open={confirm.open}
          title={confirm.title}
          description="Unsaved annotations cannot be recovered."
          confirmLabel="Remove"
          variant="destructive"
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
        />
      </SlideViewerContent>

      {overlayPanels ? (
        <OverlayPanel
          open={isRightPanelOpen}
          onOpenChange={setRightPanelOpen}
          side="right"
          title="Slide"
        >
          {slideSidebar}
        </OverlayPanel>
      ) : (
        slideSidebar
      )}

      <HoveredRoiTooltipLayer store={hoveredRoiTooltipStore} />
    </div>
  )
}
