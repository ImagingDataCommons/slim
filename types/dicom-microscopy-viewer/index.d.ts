declare module 'dicom-microscopy-viewer' {

  import * as dwc from 'dicomweb-client';
  import * as dcmjs from 'dcmjs';

  declare namespace viewer {

    export interface VolumeImageViewerOptions {
      client: dwc.api.DICOMwebClient
      metadata: object[]
      blendingInformation?: BlendingInformation[]
      controls?: string[]
      retrieveRendered?: boolean
      useWebGL?: boolean
    }

    export interface ROIStyleOptions {
      stroke?: {
        color: number[]
        width?: number
      }
      fill?: {
        color: number[]
      }
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
      get isDragZoomInteractionActive (): boolean
      activateSnapInteraction (options: object): void
      deactivateSnapInteraction (): void
      get isSnapInteractionActive (): boolean
      activateTranslateInteraction (options: object): void
      deactivateTranslateInteraction (): void
      get isTranslateInteractionActive (): boolean
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
      isOpticalPathActive (string): boolean
      getBlendingInformation (string): BlendingInformation
      setBlendingInformation (BlendingInformation): void
      showOpticalPath (string): void
      hideOpticalPath (string): void
      activateOpticalPath (string): void
      deactivateOpticalPath (string): void
      addSegments ({ metadata: Segmentation }): void
      removeSegment (segmentUID: string): void
      showSegment (segmentUID: string): void
      hideSegment (segmentUID: string): void
      isSegmentVisible (segmentUID: string): boolean
      getAllSegments (): dwc.segment.Segment[]
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
      get graphicData (): number[] | number[][]
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
      get graphicData (): number[][]
    }

    export interface PointOptions {
      frameOfReferenceUID: string
      coordinates: number[]
      fiducialUID?: string
    }

    export class Point extends Scoord3D {
      constructor (options: PointOptions)
      get graphicData (): number[]
    }

    export interface MultiPointOptions {
      frameOfReferenceUID: string
      coordinates: number[][]
      fiducialUID?: string
    }

    export class MultiPoint extends Scoord3D {
      constructor (options: MultiPointOptions)
      get graphicData (): number[][]
    }

    export interface EllipseOptions {
      frameOfReferenceUID: string
      coordinates: number[][]
      fiducialUID?: string
    }

    export class Ellipse extends Scoord3D {
      constructor (options: EllipseOptions)
      get graphicData (): number[][]
    }

    export interface EllipsoidOptions {
      frameOfReferenceUID: string
      coordinates: number[][]
      fiducialUID?: string
    }

    export class Ellipsoid extends Scoord3D {
      constructor (options: EllipsoidOptions)
      get graphicData (): number[][]
    }

    export interface PolylineOptions {
      frameOfReferenceUID: string
      coordinates: number[][]
      fiducialUID?: string
    }

    export class Polyline extends Scoord3D {
      constructor (options: PolylineOptions)
      get graphicData (): number[][]
    }

  }

  declare namespace roi {

    export interface ROIOptions {
      scoord3d: scoord3d.Scoord3D
      uid: string
      properties?: {
        trackingUID?: string
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
        trackingUID?: string
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

  declare namespace segment {

    export interface SegmentOptions {
      number: number
      label: label
      studyInstanceUID: string
      seriesInstanceUID: string
      sopInstanceUIDs: string[]
    }

    export class Segment {
      constructor (options: SegmentOptions)
      get uid (): string
      get number (): number
      get label (): string
      get algorithmType (): string
      get algorithmName (): string
      get propertyCategory (): dcmjs.sr.valueTypes.CodedConcept
      get propertyType (): dcmjs.sr.valueTypes.CodedConcept
      get studyInstanceUID (): string
      get seriesInstanceUID (): string
      get sopInstanceUIDs (): string[]
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
      NumberOfSeriesRelatedInstances: number
      SeriesInstanceUID: string
      SeriesDescription: string
      SeriesNumber: number
    }

    export interface Instance extends Series {
      SOPClassUID: string
      SOPInstanceUID: string
      InstanceNumber: number
      ImageType: string[]
      Rows?: number
      Columns?: number
      BitsAllocated?: number
      NumberOfFrames?: number
      ContainerIdentifier?: string
    }

    export class MicroscopyBulkSimpleAnnotations {
      constructor ({ metadata: Metadata }: object)
    }

    export class ParametricMap {
      constructor ({ metadata: Metadata }: object)
    }

    export class Segmentation {
      constructor ({ metadata: Metadata }: object)
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

    export interface OpticalPathDescription {
      OpticalPathIdentifier: string
      OpticalPathDescription: string
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
    }

    export interface VLWholeSlideMicroscopyImage extends SOPClass {
      // VL Whole Slide Microscopy Image module
      ImageType: string[]
      SamplesPerPixel: number
      PhotometricInterpretation: string
      // Frame of Reference module
      FrameOfReferenceUID: string
      // Specimen module
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.valueTypes.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
      // Optical Path module
      OpticalPathSequence: OpticalPathDescription[]
    }

    export interface Comprehensive3DSR extends SOPClass {
      ContentSequence: dcmjs.sr.valueTypes.ContentItem[]
      ContentTemplateSequence: {
        MappingResource: string
        TemplateIdentifier: string
      }[]
    }

    export interface MicroscopyBulkSimpleAnnotations extends SOPClass {
      // Frame of Reference module
      FrameOfReferenceUID: string
      // Specimen module
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.valueTypes.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
      // Annotation
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.valueTypes.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
      OpticalPathSequence: OpticalPathDescription[]
      AnnotationGroupSequence: {
        AnnotationGroupNumber: number
        AnnotationGroupUID: string
        AnnotationGroupLabel: string
        AnnotationGroupDescription?: string
        AnnotationPropertyCategoryCodeSequence: {
          CodeValue: string
          CodeMeaning: string
          CodingSchemeDesignator: string
          CodingSchemeVersion?: string
        }[]
        AnnotationPropertyTypeCodeSequence: {
          CodeValue: string
          CodeMeaning: string
          CodingSchemeDesignator: string
          CodingSchemeVersion?: string
        }[]
        GraphicType: string
        NumberOfAnnotations: number
        CommonZCoordinateValue?: number
        DoublePointCoordinatesData?: string  // FIXME: bytes
        PointCoordinatesData?: string  // FIXME: bytes
      }[]
    }

    export interface ParametricMap extends SOPClass {
      // Frame of Reference module
      FrameOfReferenceUID: string
      // Specimen module
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.valueTypes.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
    }

    export interface Segmentation extends SOPClass {
      // Frame of Reference module
      FrameOfReferenceUID: string
      // Specimen module
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.valueTypes.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
      // Segmentation Image module
      SegmentSequence: {
        SegmentNumber: number
        SegmentLabel: string
        SegmentDescription?: string
        SegmentedPropertyCategoryCodeSequence: {
          CodeValue: string
          CodeMeaning: string
          CodingSchemeDesignator: string
          CodingSchemeVersion?: string
        }[]
        SegmentedPropertyTypeCodeSequence: {
          CodeValue: string
          CodeMeaning: string
          CodingSchemeDesignator: string
          CodingSchemeVersion?: string
        }[]
      }[]
    }


    type Metadata = Study|Series|Instance|VLWholeSlideMicroscopyImage

    export function formatMetadata (metadata: object): Metadata

  }

  declare namespace channel {

    export interface BlendingInformation {
      opticalPathIdentifier: string
      color: number[]
      opacity: number
      thresholdValues: number[]
      limitValues: number[]
      visible: boolean
    }
    
  }

}
