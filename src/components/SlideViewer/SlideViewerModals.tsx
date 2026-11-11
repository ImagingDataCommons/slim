import type React from 'react'

import type {
  GoToField,
  GoToInput,
  GoToRanges,
} from '../../features/viewer/utils/goTo'
import AnnotationModal from './AnnotationModal'
import GoToModal from './GoToModal'
import ReportModal from './ReportModal'
import SelectedRoiModal from './SelectedRoiModal'

export interface SlideViewerModalsProps {
  isAnnotationModalVisible: boolean
  onAnnotationConfigurationCompletion: () => void
  onAnnotationConfigurationCancellation: () => void
  isAnnotationOkDisabled: boolean
  annotationConfigurations: React.ReactNode

  isSelectedRoiModalVisible: boolean
  onRoiSelectionCancellation: () => void
  selectedRoiInformation: React.ReactNode

  isGoToModalVisible: boolean
  goToInput: GoToInput
  goToRanges: GoToRanges
  onGoToInputChange: (field: GoToField, value: string) => void
  onSlidePositionSelection: () => void
  onSlidePositionSelectionCancellation: () => void

  isReportModalVisible: boolean
  onReportVerification: () => void
  onReportCancellation: () => void
  report: React.ReactNode
}

/** All modals of the slide viewer. */
const SlideViewerModals = ({
  isAnnotationModalVisible,
  onAnnotationConfigurationCompletion,
  onAnnotationConfigurationCancellation,
  isAnnotationOkDisabled,
  annotationConfigurations,
  isSelectedRoiModalVisible,
  onRoiSelectionCancellation,
  selectedRoiInformation,
  isGoToModalVisible,
  goToInput,
  goToRanges,
  onGoToInputChange,
  onSlidePositionSelection,
  onSlidePositionSelectionCancellation,
  isReportModalVisible,
  onReportVerification,
  onReportCancellation,
  report,
}: SlideViewerModalsProps): React.ReactElement => (
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
      input={goToInput}
      ranges={goToRanges}
      onInputChange={onGoToInputChange}
      onOk={onSlidePositionSelection}
      onCancel={onSlidePositionSelectionCancellation}
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

export default SlideViewerModals
