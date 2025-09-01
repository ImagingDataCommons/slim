// skipcq: JS-C1003
import * as dmv from "dicom-microscopy-viewer";
// skipcq: JS-C1003
import * as dcmjs from "dcmjs";
import { RouteComponentProps } from "../../utils/router";
import { Slide } from "../../data/slides";
import DicomWebManager from "../../DicomWebManager";
import { AnnotationSettings } from "../../types/annotations";

/**
 * Style options for ROI annotations
 */
export interface StyleOptions {
  opacity: number;
  color: number[];
  contourOnly: boolean;
}

/**
 * Evaluation options for DICOM SR
 */
export interface EvaluationOptions {
  name: dcmjs.sr.coding.CodedConcept;
  values: dcmjs.sr.coding.CodedConcept[];
}

/**
 * Evaluation for DICOM SR
 */
export interface Evaluation {
  name: dcmjs.sr.coding.CodedConcept;
  value: dcmjs.sr.coding.CodedConcept;
}

/**
 * Measurement for DICOM SR
 */
export interface Measurement {
  name: dcmjs.sr.coding.CodedConcept;
  value?: number;
  unit: dcmjs.sr.coding.CodedConcept;
}

/**
 * Props for the main SlideViewer component
 */
export interface SlideViewerProps extends RouteComponentProps {
  slide: Slide;
  clients: { [key: string]: DicomWebManager };
  studyInstanceUID: string;
  seriesInstanceUID: string;
  app: {
    name: string;
    version: string;
    uid: string;
    organization?: string;
  };
  annotations: AnnotationSettings[];
  enableAnnotationTools: boolean;
  preload: boolean;
  user?: {
    name: string | undefined;
    email: string | undefined;
  };
  selectedPresentationStateUID?: string;
  derivedDataset?: dmv.metadata.Dataset;
}

/**
 * State for the main SlideViewer component
 */
export interface SlideViewerState {
  visibleRoiUIDs: Set<string>;
  visibleSegmentUIDs: Set<string>;
  visibleMappingUIDs: Set<string>;
  visibleAnnotationGroupUIDs: Set<string>;
  visibleOpticalPathIdentifiers: Set<string>;
  activeOpticalPathIdentifiers: Set<string>;
  presentationStates: dmv.metadata.AdvancedBlendingPresentationState[];
  selectedPresentationStateUID?: string;
  selectedFinding?: dcmjs.sr.coding.CodedConcept;
  selectedEvaluations: Evaluation[];
  selectedGeometryType?: string;
  selectedMarkup?: string;
  selectedRoi?: dmv.roi.ROI;
  selectedRoiUIDs: Set<string>;
  generatedReport?: dmv.metadata.Comprehensive3DSR;
  isLoading: boolean;
  isAnnotationModalVisible: boolean;
  isSelectedRoiModalVisible: boolean;
  isHoveredRoiTooltipVisible: boolean;
  hoveredRoiAttributes: Array<{
    index: number;
    roiUid: string;
    attributes: Array<{ name: string; value: string }>;
  }>;
  hoveredRoiTooltipX: number;
  hoveredRoiTooltipY: number;
  isReportModalVisible: boolean;
  isRoiDrawingActive: boolean;
  isRoiModificationActive: boolean;
  isRoiTranslationActive: boolean;
  isGoToModalVisible: boolean;
  isSelectedMagnificationValid: boolean;
  isSelectedXCoordinateValid: boolean;
  isSelectedYCoordinateValid: boolean;
  selectedXCoordinate?: number;
  validXCoordinateRange: number[];
  selectedYCoordinate?: number;
  validYCoordinateRange: number[];
  selectedMagnification?: number;
  areRoisHidden: boolean;
  selectedSeriesInstanceUID?: string;
  pixelDataStatistics: {
    [opticalPathIdentifier: string]: {
      min: number;
      max: number;
      numFramesSampled: number;
    };
  };
  loadingFrames: Set<string>;
  isICCProfilesEnabled: boolean;
  findingsOptions: dcmjs.sr.coding.CodedConcept[];
  isFindingLoading: boolean;
  findingQuery: string;
  findingPage: number;
  findingPageSize: number;
  hasMoreFindings: boolean;
  isFindingLoadingMore: boolean;
  // magnification widget
  availableMagnifications: Array<{ level: number; mag: number; label: string }>;
}
