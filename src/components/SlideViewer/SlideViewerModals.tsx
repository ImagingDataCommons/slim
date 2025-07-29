import React from 'react'
import AnnotationModal from './AnnotationModal'
import SelectedRoiModal from './SelectedRoiModal'
import GoToModal from './GoToModal'
import ReportModal from './ReportModal'

interface SlideViewerModalsProps {
  // Annotation Modal
  isAnnotationModalVisible: boolean
  onAnnotationConfigurationCompletion: () => void
  onAnnotationConfigurationCancellation: () => void
  isAnnotationOkDisabled: boolean
  annotationConfigurations: React.ReactNode

  // Selected ROI Modal
  isSelectedRoiModalVisible: boolean
  onRoiSelectionCancellation: () => void
  selectedRoiInformation: React.ReactNode

  // Go To Modal
  isGoToModalVisible: boolean
  onSlidePositionSelection: () => void
  onSlidePositionSelectionCancellation: () => void
  validXCoordinateRange: number[]
  validYCoordinateRange: number[]
  isSelectedXCoordinateValid: boolean
  isSelectedYCoordinateValid: boolean
  isSelectedMagnificationValid: boolean
  onXCoordinateSelection: (value: any) => void
  onYCoordinateSelection: (value: any) => void
  onMagnificationSelection: (value: any) => void

  // Report Modal
  isReportModalVisible: boolean
  onReportVerification: () => void
  onReportCancellation: () => void
  report: React.ReactNode
}

/**
 * Component that renders all modals for the SlideViewer
 */
const SlideViewerModals: React.FC<SlideViewerModalsProps> = ({
  // Annotation Modal
  isAnnotationModalVisible,
  onAnnotationConfigurationCompletion,
  onAnnotationConfigurationCancellation,
  isAnnotationOkDisabled,
  annotationConfigurations,

  // Selected ROI Modal
  isSelectedRoiModalVisible,
  onRoiSelectionCancellation,
  selectedRoiInformation,

  // Go To Modal
  isGoToModalVisible,
  onSlidePositionSelection,
  onSlidePositionSelectionCancellation,
  validXCoordinateRange,
  validYCoordinateRange,
  isSelectedXCoordinateValid,
  isSelectedYCoordinateValid,
  isSelectedMagnificationValid,
  onXCoordinateSelection,
  onYCoordinateSelection,
  onMagnificationSelection,

  // Report Modal
  isReportModalVisible,
  onReportVerification,
  onReportCancellation,
  report
}) => {
  return (
    <>
      <AnnotationModal
        isVisible={isAnnotationModalVisible}
        onOk={onAnnotationConfigurationCompletion}
        onCancel={onAnnotationConfigurationCancellation}
        isOkDisabled={isAnnotationOkDisabled}
      >
        {annotationConfigurations}
      </AnnotationModal>

      <SelectedRoiModal
        isVisible={isSelectedRoiModalVisible}
        onCancel={onRoiSelectionCancellation}
      >
        {selectedRoiInformation}
      </SelectedRoiModal>

      <GoToModal
        isVisible={isGoToModalVisible}
        onOk={onSlidePositionSelection}
        onCancel={onSlidePositionSelectionCancellation}
        validXCoordinateRange={validXCoordinateRange}
        validYCoordinateRange={validYCoordinateRange}
        isSelectedXCoordinateValid={isSelectedXCoordinateValid}
        isSelectedYCoordinateValid={isSelectedYCoordinateValid}
        isSelectedMagnificationValid={isSelectedMagnificationValid}
        onXCoordinateSelection={onXCoordinateSelection}
        onYCoordinateSelection={onYCoordinateSelection}
        onMagnificationSelection={onMagnificationSelection}
      />

      <ReportModal
        isVisible={isReportModalVisible}
        onOk={onReportVerification}
        onCancel={onReportCancellation}
      >
        {report}
      </ReportModal>
    </>
  )
}

export default SlideViewerModals
