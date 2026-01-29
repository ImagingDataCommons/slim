// skipcq: JS-C1003 - dcmjs uses nested namespaces (dcmjs.sr.coding.CodedConcept)
import type * as dcmjs from 'dcmjs'
// skipcq: JS-C1003 - dmv uses nested namespaces (dmv.metadata, dmv.roi)
import type * as dmv from 'dicom-microscopy-viewer'
import type DicomWebManager from '../../DicomWebManager'
import type { Slide } from '../../data/slides'
import type { AnnotationSettings } from '../../types/annotations'
import type { RouteComponentProps } from '../../utils/router'

/**
 * Style options for ROI annotations
 */
export interface StyleOptions {
  opacity: number
  color: number[]
  contourOnly: boolean
}

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
  app: {
    name: string
    version: string
    uid: string
    organization?: string
  }
  annotations: AnnotationSettings[]
  enableAnnotationTools: boolean
  preload: boolean
  user?: {
    name: string | undefined
    email: string | undefined
  }
  selectedPresentationStateUID?: string
  derivedDataset?: dmv.metadata.Dataset
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
  generatedReport?: dmv.metadata.Comprehensive3DSR
  isLoading: boolean
  isAnnotationModalVisible: boolean
  isSelectedRoiModalVisible: boolean
  isHoveredRoiTooltipVisible: boolean
  hoveredRoiAttributes: Array<{
    index: number
    roiUid: string
    attributes: Array<{ name: string; value: string }>
    seriesDescription?: string
  }>
  hoveredRoiTooltipX: number
  hoveredRoiTooltipY: number
  isReportModalVisible: boolean
  isRoiDrawingActive: boolean
  isRoiModificationActive: boolean
  isRoiTranslationActive: boolean
  isGoToModalVisible: boolean
  isSelectedMagnificationValid: boolean
  isSelectedXCoordinateValid: boolean
  isSelectedYCoordinateValid: boolean
  selectedXCoordinate?: number
  validXCoordinateRange: number[]
  selectedYCoordinate?: number
  validYCoordinateRange: number[]
  selectedMagnification?: number
  areRoisHidden: boolean
  selectedSeriesInstanceUID?: string
  selectedSegmentationSeriesInstanceUID?: string
  pixelDataStatistics: {
    [opticalPathIdentifier: string]: {
      min: number
      max: number
      numFramesSampled: number
    }
  }
  loadingFrames: Set<string>
  isICCProfilesEnabled: boolean
  isSegmentationInterpolationEnabled: boolean
  isParametricMapInterpolationEnabled: boolean
  customizedSegmentColors: { [segmentUID: string]: number[] }
  clusteringPixelSizeThreshold: number | null
  isClusteringEnabled: boolean
}
