/** skipcq: JS-C1003 - dcmjs uses nested namespaces (dcmjs.sr.coding.CodedConcept) */
import type * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 - dmv uses nested namespaces (dmv.metadata, dmv.roi) */
import type * as dmv from 'dicom-microscopy-viewer'
import type DicomWebManager from '../../DicomWebManager'
import type { Slide } from '../../data/slides'
import type { GoToInput } from '../../features/viewer/utils/goTo'
import type { ViewportLoadingPhase } from '../../features/viewer/utils/viewportLoading'
import type { AnnotationSettings } from '../../types/annotations'
import type { AppInfo } from '../../utils/appInfo'
import type { RouteComponentProps } from '../../utils/router'

/**
 * Evaluation options for DICOM SR
 */
export interface EvaluationOptions {
  name: dcmjs.sr.coding.CodedConcept
  values: dcmjs.sr.coding.CodedConcept[]
}

/**
 * Evaluation for DICOM SR
 */
export interface Evaluation {
  name: dcmjs.sr.coding.CodedConcept
  value: dcmjs.sr.coding.CodedConcept
}

/**
 * Measurement for DICOM SR
 */
export interface Measurement {
  name: dcmjs.sr.coding.CodedConcept
  value?: number
  unit: dcmjs.sr.coding.CodedConcept
}

/**
 * Props for the main SlideViewer component
 */
export interface SlideViewerProps extends RouteComponentProps {
  slide: Slide
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  seriesInstanceUID: string
  app: AppInfo
  annotations: AnnotationSettings[]
  enableAnnotationTools: boolean
  preload: boolean
  user?: {
    name: string | undefined
    email: string | undefined
  }
  selectedPresentationStateUID?: string
  derivedDataset?: dmv.metadata.Dataset
  isLeftPanelOpen?: boolean
  onToggleLeftPanel?: () => void
  enableMemoryMonitoring?: boolean
}

/**
 * State for the main SlideViewer component
 */
export interface SlideViewerState {
  visibleRoiUIDs: Set<string>
  visibleSegmentUIDs: Set<string>
  visibleMappingUIDs: Set<string>
  visibleAnnotationGroupUIDs: Set<string>
  visibleOpticalPathIdentifiers: Set<string>
  activeOpticalPathIdentifiers: Set<string>
  presentationStates: dmv.metadata.AdvancedBlendingPresentationState[]
  selectedPresentationStateUID?: string
  selectedFinding?: dcmjs.sr.coding.CodedConcept
  selectedEvaluations: Evaluation[]
  selectedGeometryType?: string
  selectedMarkup?: string
  selectedRoi?: dmv.roi.ROI
  selectedRoiUIDs: Set<string>
  /** Naturalized Comprehensive 3D SR awaiting verification */
  generatedReport?: dmv.metadata.Comprehensive3DSR
  isLoading: boolean
  isAnnotationModalVisible: boolean
  isSelectedRoiModalVisible: boolean
  isReportModalVisible: boolean
  isRoiDrawingActive: boolean
  isRoiModificationActive: boolean
  isRoiTranslationActive: boolean
  isGoToModalVisible: boolean
  /** Raw text of the "Go to position" fields */
  goToInput: GoToInput
  validXCoordinateRange: [number, number]
  validYCoordinateRange: [number, number]
  areRoisHidden: boolean
  selectedSeriesInstanceUID?: string
  selectedSegmentationSeriesInstanceUID?: string
  viewportLoadingPhase: ViewportLoadingPhase
  isICCProfilesEnabled: boolean
  isPaletteDisplayGammaCorrectionEnabled: boolean
  isSegmentationInterpolationEnabled: boolean
  isParametricMapInterpolationEnabled: boolean
  customizedSegmentColors: { [segmentUID: string]: number[] }
  /** Raw threshold field text (mm); '' means automatic */
  clusteringThresholdInput: string
  isClusteringEnabled: boolean
  isRightPanelOpen: boolean
  /** Incremented whenever the DMV viewers are (re)constructed */
  viewerGeneration: number
  isRoiRemovalConfirmVisible: boolean
}
