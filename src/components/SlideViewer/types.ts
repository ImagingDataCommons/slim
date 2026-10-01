/** skipcq: JS-C1003 - dcmjs uses nested namespaces (dcmjs.sr.coding.CodedConcept) */
import type * as dcmjs from 'dcmjs'
/** skipcq: JS-C1003 - dmv uses nested namespaces (dmv.metadata, dmv.roi) */
import type * as dmv from 'dicom-microscopy-viewer'
import type DicomWebManager from '../../DicomWebManager'
import type { Slide } from '../../data/slides'
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
