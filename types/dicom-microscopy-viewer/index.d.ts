declare module 'dicom-microscopy-viewer' {

  import * as dwc from 'dicomweb-client';
  import * as dcmjs from 'dcmjs';

  declare namespace viewer {

    export interface VolumeImageViewerOptions {
      client: dwc.api.DICOMwebClient
      metadata: object[]
      controls?: string[]
      retrieveRendered?: boolean
      useWebGL?: boolean
    }

    export class VolumeImageViewer {
      constructor (options: VolumeImageViewerOptions)
      render (options: object): void
      get imageMetadata (): metadata.VLWholeSlideMicroscopyImage[]
      activateDrawInteraction (options: object)
      deactivateDrawInteraction (): void
      get isDrawInteractionActive (): boolean
      activateSelectInteraction (options: object)
      deactivateSelectInteraction (): void
      get isSelectInteractionActive (): boolean
      activateModifyInteraction (options: object)
      deactivateModifyInteraction (): void
      get isModifyInteractionActive (): boolean
      activateDragZoomInteraction (options: object): void
      deactivateDragZoomInteraction (): void
      get isDragZoomInteractionActive (): boolen
      activateSnapInteraction (options: object): void
      deactivateSnapInteraction (): void
      get isSnapInteractionActive (): boolen
      activateTranslateInteraction (options: object): void
      deactivateTranslateInteraction (): void
      get isTranslateInteractionActive (): boolen
      getAllROIs (): roi.ROI[]
      removeAllROIs (): void
      getROI (uid: string): roi.ROI
      popROI (): roi.ROI
      addROI (item: roi.ROI, styleOptions?: object)
      setROIStyle (uid: string, styleOptions?: object): void
      addROIMeasurement (
        uid: string,
        item: dcmjs.sr.valueTypes.NumContentItem
      ): void
      addROIEvaluation (
        uid: string,
        item: (
          dcmjs.sr.valueTypes.CodeContentItem |
          dcmjs.sr.valueTypes.TextContentItem
        )
      ): void
      removeROI (uid: string)
      get numberOfROIs (): number
      hideROIs (): void
      showROIs (): void
      get areROIsVisible (): boolean
      resize (): void
      collapseOverviewMap (): void
      expandOverviewMap (): void
      toggleOverviewMap (): void
    }

    export interface OverviewImageViewerOptions {
      client: dwc.api.DICOMwebClient
      metadata: object
      orientation?: string
      resizeFactor?: number
      includeIccProfile?: boolean
    }

    export class OverviewImageViewer {
      constructor (options: OverviewImageViewerOptions)
      render (options: object): void
      get imageMetadata (): metadata.VLWholeSlideMicroscopyImage[]
      resize (): void
    }

    export interface LabelImageViewerOptions {
      client: dwc.api.DICOMwebClient
      metadata: object
      orientation?: string
      resizeFactor?: number
      includeIccProfile?: boolean
    }

    export class LabelImageViewer {
      constructor (options: OverviewImageViewerOptions)
      render (options: object): void
      get imageMetadata (): metadata.VLWholeSlideMicroscopyImage[]
      resize (): void
    }
  }

  declare namespace scoord3d {

    export class Scoord3D {
      get graphicType (): string
      get graphicData (): number[]
      get frameOfReferenceUID (): string
      get fiducialUID (): string
    }

    export interface PolygonOptions {
      frameOfReferenceUID: string
      coordinates: number[][]
      fiducialUID?: string
    }

    export class Polygon extends Scoord3D {
      constructor (options: PolygonOptions)
    }

    export interface PointOptions {
      frameOfReferenceUID: string
      coordinates: number[]
      fiducialUID?: string
    }

    export class Point extends Scoord3D {
      constructor (options: PointOptions)
    }

    export interface MultiPointOptions {
      frameOfReferenceUID: string
      coordinates: number[][]
      fiducialUID?: string
    }

    export class MultiPoint extends Scoord3D {
      constructor (options: MultiPointOptions)
    }

    export interface EllipseOptions {
      frameOfReferenceUID: string
      coordinates: number[][]
      fiducialUID?: string
    }

    export class Ellipse extends Scoord3D {
      constructor (options: EllipseOptions)
    }

    export interface EllipsoidOptions {
      frameOfReferenceUID: string
      coordinates: number[][]
      fiducialUID?: string
    }

    export class Ellipsoid extends Scoord3D {
      constructor (options: EllipsoidOptions)
    }

    export interface PolylineOptions {
      frameOfReferenceUID: string
      coordinates: number[][]
      fiducialUID?: string
    }

    export class Polyline extends Scoord3D {
      constructor (options: PolylineOptions)
    }

  }

  declare namespace roi {

    export interface ROIOptions {
      scoord3d: scoord3d.Scoord3D
      uid: string
      properties?: {
        observerType?: string
        evaluations?: (
          dcmjs.sr.valueTypes.CodeContentItem |
          dcmjs.sr.valueTypes.TextContentItem
        )[]
        measurements?: dcmjs.sr.valueTypes.NumContentItem[]
      }
    }

    export class ROI {
      constructor (options: ROIOptions)
      get scoord3d (): scoord3d.Scoord3D
      get uid (): string
      get properties (): {
        observerType?: string
        evaluations: (
          dcmjs.sr.valueTypes.CodeContentItem |
          dcmjs.sr.valueTypes.TextContentItem
        )[]
        measurements: dcmjs.sr.valueTypes.NumContentItem[]
      }
      get evaluations (): (
          dcmjs.sr.valueTypes.CodeContentItem |
          dcmjs.sr.valueTypes.TextContentItem
      )[]
      get measurements (): dcmjs.sr.valueTypes.NumContentItem[]
      addEvaluation (
        item: (
          dcmjs.sr.valueTypes.CodeContentItem |
          dcmjs.sr.valueTypes.TextContentItem
        )
      ): void
      addMeasurement (item: dcmjs.sr.valueTypes.NumContentItem): void
    }

  }

  declare namespace metadata {

    export interface PersonName {
      Alphabetic: string
    }

    export interface Study {
      ModalitiesInStudy: string[]
      ReferringPhysicianName: PersonName
      PatientName: PersonName
      PatientID: string
      PatientSex: string
      PatientBirthDate: string
      StudyInstanceUID: string
      StudyID: string
      StudyDate: string
      StudyTime: string
      AccessionNumber: string
      NumberOfStudyRelatedSeries: number
      NumberOfStudyRelatedInstances: number
      InstanceAvailability?: string
      RetrieveURL?: string
      TimezoneOffsetFromUTC?: string
    }

    export interface Series extends Study {
      Modality: string
      SeriesInstanceUID: string
      SeriesDescription: string
      SeriesNumber: number
      NumberOfSeriesRelatedInstances: number
    }

    export interface Instance extends Series {
      SOPClassUID: string
      SOPInstanceUID: string
      InstanceNumber: number
      Rows?: number
      Columns?: number
      BitsAllocated?: number
      NumberOfFrames?: number
      ImageType?: string[] // may be included
    }

    export class VLWholeSlideMicroscopyImage {
      constructor ({ metadata: Metadata }: object)
    }

    export interface SpecimenPreparation {
      SpecimenPreparationStepContentItemSequence: (
        dcmjs.sr.valueTypes.CodeContentItem |
        dcmjs.sr.valueTypes.TextContentItem |
        dcmjs.sr.valueTypes.UIDRefContentItem |
        dcmjs.sr.valueTypes.PNameContentItem |
        dcmjs.sr.valueTypes.DateTimeContentItem
      )[]
    }

    export interface SpecimenDescription {
      SpecimenUID: string
      SpecimenIdentifier: string
      SpecimenTypeCodeSequence: dcmjs.sr.valueTypes.CodedConcept[]
      SpecimenDetailedDescription?: string
      SpecimenShortDescription?: string
      SpecimenPreparationSequence: SpecimenPreparation[]
      PrimaryAnatomicStructureSequence: dcmjs.sr.valueTypes.CodedConcept[]
    }

    export interface SOPClass {
      // Patient module
      PatientID: string
      PatientName: PersonName
      PatientSex: string
      PatientBirthDate: string
      ReferringPhysicianName: PersonName
      // General Study module
      StudyInstanceUID: string
      AccessionNumber: string
      StudyID: string
      StudyDate: string
      StudyTime: string
      // General Series module
      SeriesInstanceUID: string
      Modality: string
      // SOP Common module
      SOPClassUID: string
      SOPInstanceUID: string
      // Specimen module
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.valueTypes.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
    }

    export interface VLWholeSlideMicroscopyImage extends SOPClass {
      // VL Whole Slide Microscopy Image module
      ImageType: string[]
      FrameOfReferenceUID: string
    }

    export interface Comprehensive3DSR extends SOPClass {
      ContentSequence: dcmjs.sr.valueTypes.ContentItem[]
    }

    type Metadata = Study|Series|Instance|VLWholeSlideMicroscopyImage

    export function formatMetadata (metadata: object): Metadata

  }

}
