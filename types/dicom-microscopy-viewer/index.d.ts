declare module 'dicom-microscopy-viewer' {

  import * as dwc from 'dicomweb-client'
  import * as dcmjs from 'dcmjs'
  import { CustomError } from '../../src/utils/CustomError'

  declare namespace viewer {

    export interface VolumeImageViewerOptions {
      client?: dwc.api.DICOMwebClient
      clientMapping?: { [key: string]: dwc.api.DICOMwebClient }
      metadata: metadata.VLWholeSlideMicroscopyImage[]
      debug?: boolean
      preload?: boolean
      controls: string[]
      annotationOptions?: object
      errorInterceptor?: (error: CustomError) => void
    }

    export interface ROIStyleOptions {
      stroke?: {
        color: number[]
        width?: number
      }
      fill?: {
        color: number[]
      }
      image?: {
        circle?: {
          radius?: number
          stroke?: {
            color: number[]
            width?: number
          }
          fill?: {
            color: number[]
          }
        }
      }
    }

    export class VolumeImageViewer {
      constructor (options: VolumeImageViewerOptions)
      render (options: object): void
      navigate (options: { level?: number, position?: number[] })
      cleanup (): void
      get numLevels (): number
      get frameOfReferenceUID (): string
      getPixelSpacing (level: number): number[]
      get physicalOffset (): number[]
      get physicalSize (): number[]
      get boundingBox (): number[][]
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
      getROIStyle (uid: string): object
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
      get size (): number[]
      collapseOverviewMap (): void
      expandOverviewMap (): void
      toggleOverviewMap (): void
      isOpticalPathActive (opticalPathIdentifier: string): boolean
      isOpticalPathColorable (opticalPathIdentifier: string): boolean
      isOpticalPathMonochromatic (opticalPathIdentifier: string): boolean
      getOpticalPathDefaultStyle (opticalPathIdentifier: string): {
        color?: number[]
        paletteColorLookupTable?: color.PaletteColorLookupTable
        opacity: number
        limitValues?: number[]
      }
      getOpticalPathStyle (opticalPathIdentifier: string): {
        color?: number[]
        paletteColorLookupTable?: color.PaletteColorLookupTable
        opacity: number
        limitValues?: number[]
      }
      setOpticalPathStyle (
        opticalPathIdentifier: string,
        styleOptions: {
          color?: number[]
          paletteColorLookupTable?: color.PaletteColorLookupTable
          opacity?: number
          limitValues?: number[]
        }
      ): void
      showOpticalPath (
        opticalPathIdentifier: string,
        styleOptions?: {
          color?: number[]
          opacity?: number
          paletteColorLookupTable?: color.PaletteColorLookupTable
          limitValues?: number[]
        }
      ): void
      hideOpticalPath (opticalPathIdentifier: string): void
      isOpticalPathVisible (opticalPathIdentifier: string): boolean
      activateOpticalPath (opticalPathIdentifier: string): void
      deactivateOpticalPath (opticalPathIdentifier: string): void
      getOpticalPathMetadata (
        opticalPathIdentifier: string
      ): metadata.VLWholeSlideMicroscopyImage[]
      getAllOpticalPaths (): dwc.opticalPath.OpticalPath[]
      addSegments (metadata: metadata.Segmentation[]): void
      removeSegment (segmentUID: string): void
      showSegment (
        segmentUID: string,
        styleOptions?: {
          opacity?: number
        }
      ): void
      hideSegment (segmentUID: string): void
      setSegmentStyle (
        segmentUID: string,
        styleOptions: {
          opacity?: number
          paletteColorLookupTable?: color.PaletteColorLookupTable
        }
      ): void
      getSegmentDefaultStyle (segmentUID: string): {
        opacity: number
        paletteColorLookupTable: color.PaletteColorLookupTable
      }
      getSegmentStyle (segmentUID: string): {
        opacity: number
        paletteColorLookupTable: color.PaletteColorLookupTable
      }
      isSegmentVisible (segmentUID: string): boolean
      getSegmentMetadata (segmentUID: string): metadata.Segmentation[]
      getAllSegments (): dwc.segment.Segment[]
      addParameterMappings (metadata: metadata.ParametricMap[]): void
      removeParameterMapping (mappingUID: string): void
      showParameterMapping (
        mappingUID: string,
        styleOptions?: {
          opacity?: number
        }
      ): void
      hideParameterMapping (mappingUID: string): void
      setParameterMappingStyle (
        mappingUID: string,
        styleOptions: {
          opacity?: number
          paletteColorLookupTable?: color.PaletteColorLookupTable
        }
      ): void
      getParameterMappingDefaultStyle (mappingUID: string): {
        opacity: number
        paletteColorLookupTable: color.PaletteColorLookupTable
      }
      getParameterMappingStyle (mappingUID: string): {
        opacity: number
        paletteColorLookupTable: color.PaletteColorLookupTable
      }
      isParameterMappingVisible (mappingUID: string): boolean
      getParameterMappingMetadata (mappingUID: string): metadata.ParametricMap[]
      getAllParameterMappings (): dwc.mapping.ParameterMapping[]
      addAnnotationGroups (
        metadata: metadata.MicroscopyBulkSimpleAnnotations
      ): void
      removeAnnotationGroup (annotationGroupUID: string): void
      showAnnotationGroup (
        annotationGroupUID: string,
        styleOptions?: {
          opacity?: number
          color?: number[]
          measurement?: dcmjs.sr.coding.CodedConcept
        }
      ): void
      hideAnnotationGroup (annotationGroupUID: string): void
      setAnnotationGroupStyle (
        annotationGroupUID: string,
        styleOptions: {
          opacity?: number
          color?: number[]
          measurement?: dcmjs.sr.coding.CodedConcept
        }
      ): void
      getAnnotationGroupStyle (annotationGroupUID: string): {
        opacity: number
        color: number[]
      }
      isAnnotationGroupVisible (annotationGroupUID: string): boolean
      getAllAnnotationGroups (): dwc.annotation.AnnotationGroup[]
      getAnnotationGroupMetadata (
        annotationGroupUID: string
      ): metadata.MicroscopyBulkSimpleAnnotations
    }

    export interface OverviewImageViewerOptions {
      client: dwc.api.DICOMwebClient
      metadata: object
      orientation?: string
      resizeFactor?: number
      includeIccProfile?: boolean
      errorInterceptor?: (error: CustomError) => void
    }

    export class OverviewImageViewer {
      constructor (options: OverviewImageViewerOptions)
      render (options: object): void
      cleanup (): void
      get imageMetadata (): metadata.VLWholeSlideMicroscopyImage[]
      resize (): void
      get size (): number[]
    }

    export interface LabelImageViewerOptions {
      client: dwc.api.DICOMwebClient
      metadata: object
      orientation?: string
      resizeFactor?: number
      includeIccProfile?: boolean
      errorInterceptor?: (error: CustomError) => void
    }

    export class LabelImageViewer {
      constructor (options: OverviewImageViewerOptions)
      render (options: object): void
      cleanup (): void
      get imageMetadata (): metadata.VLWholeSlideMicroscopyImage[]
      resize (): void
      get size (): number[]
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
      uid?: string
      properties?: {
        trackingUID?: string
        observerType?: string
        evaluations?: Array<dcmjs.sr.valueTypes.CodeContentItem |
        dcmjs.sr.valueTypes.TextContentItem>
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
        evaluations: Array<dcmjs.sr.valueTypes.CodeContentItem |
        dcmjs.sr.valueTypes.TextContentItem>
        measurements: dcmjs.sr.valueTypes.NumContentItem[]
      }
      get evaluations (): Array<dcmjs.sr.valueTypes.CodeContentItem |
      dcmjs.sr.valueTypes.TextContentItem>
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
      uid: string
      number: number
      label: label
      algorithmType: string
      algorithmName: string
      propertyCategory: dcmjs.sr.coding.CodedConcept
      propertyType: dcmjs.sr.coding.CodedConcept
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
      get propertyCategory (): dcmjs.sr.coding.CodedConcept
      get propertyType (): dcmjs.sr.coding.CodedConcept
      get studyInstanceUID (): string
      get seriesInstanceUID (): string
      get sopInstanceUIDs (): string[]
    }

  }

  declare namespace metadata {

    export interface PersonName {
      Alphabetic: string
    }

    export interface Study extends Dataset {
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
      AnnotationCoordinateType: string
      constructor ({ metadata: Dataset }: object)
    }

    export class ParametricMap {
      constructor ({ metadata: Dataset }: object)
    }

    export class Segmentation {
      constructor ({ metadata: Dataset }: object)
    }

    export class VLWholeSlideMicroscopyImage {
      constructor ({ metadata: Dataset }: object)
    }

    export interface SpecimenPreparation {
      SpecimenPreparationStepContentItemSequence: Array<dcmjs.sr.valueTypes.CodeContentItem |
      dcmjs.sr.valueTypes.TextContentItem |
      dcmjs.sr.valueTypes.UIDRefContentItem |
      dcmjs.sr.valueTypes.PNameContentItem |
      dcmjs.sr.valueTypes.DateTimeContentItem>
    }

    export interface SpecimenDescription {
      SpecimenUID: string
      SpecimenIdentifier: string
      SpecimenTypeCodeSequence: dcmjs.sr.coding.CodedConcept[]
      SpecimenDetailedDescription?: string
      SpecimenShortDescription?: string
      SpecimenPreparationSequence: SpecimenPreparation[]
      PrimaryAnatomicStructureSequence: dcmjs.sr.coding.CodedConcept[]
    }

    export interface OpticalPath {
      OpticalPathIdentifier: string
      OpticalPathDescription: string
      ICCProfile?: Uint8Array
    }

    export interface Dataset {}

    export interface SOPClass extends Dataset {
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
      // Clinical Trial Subject module
      ClinicalTrialSponsorName?: string
      ClinicalTrialProtocolID?: string
      ClinicalTrialProtocolName?: string
      ClinicalTrialSiteName?: string
      // Clinical Trial Study module
      ClinicalTrialTimePointID?: string
      // General Series module
      SeriesInstanceUID: string
      SeriesNumber: number | null | undefined
      SeriesDate: string
      SeriesTime: string
      SeriesDescription: string
      Modality: string
      // SOP Common module
      SOPClassUID: string
      SOPInstanceUID: string
      InstanceNumber: number | null | undefined
      get json (): object
      get bulkdataReferences (): object
    }

    export interface VLWholeSlideMicroscopyImage extends SOPClass {
      // VL Whole Slide Microscopy Image module
      BitsAllocated: number
      ImageType: string[]
      SamplesPerPixel: number
      PhotometricInterpretation: string
      // Acquisition
      AcquisitionUID?: string
      // Multi-Resolution Pyramid
      PyramidUID?: string
      // Frame of Reference module
      FrameOfReferenceUID: string
      // Specimen module
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.coding.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
      // Optical Path module
      OpticalPathSequence: OpticalPath[]
      // Equipment module
      Manufacturer: string
      ManufacturerModelName: string
      DeviceSerialNumber: string
      SoftwareVersions: string | string[]
      InstitutionName?: string
    }

    export interface Comprehensive3DSR extends SOPClass {
      ContentSequence: dcmjs.sr.valueTypes.ContentItem[]
      ContentTemplateSequence: Array<{
        MappingResource: string
        TemplateIdentifier: string
      }>
    }

    export interface MicroscopyBulkSimpleAnnotations extends SOPClass {
      AnnotationCoordinateType: string
      // Frame of Reference module
      FrameOfReferenceUID: string
      // Specimen module
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.coding.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
      // Annotation
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.coding.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
      OpticalPathSequence: OpticalPath[]
      AnnotationGroupSequence: Array<{
        SOPClassUID: string
        AnnotationGroupNumber: number
        AnnotationGroupUID: string
        AnnotationGroupLabel: string
        AnnotationGroupDescription?: string
        AnnotationPropertyCategoryCodeSequence: Array<{
          CodeValue: string
          CodeMeaning: string
          CodingSchemeDesignator: string
          CodingSchemeVersion?: string
        }>
        AnnotationPropertyTypeCodeSequence: Array<{
          CodeValue: string
          CodeMeaning: string
          CodingSchemeDesignator: string
          CodingSchemeVersion?: string
        }>
        GraphicType: string
        NumberOfAnnotations: number
        CommonZCoordinateValue?: number
        DoublePointCoordinatesData?: string // FIXME: bytes
        PointCoordinatesData?: string // FIXME: bytes
        MeasurementsSequence: Array<{
          ConceptNameCodeSequence: Array<{
            CodeValue: string
            CodeMeaning: string
            CodingSchemeDesignator: string
            CodingSchemeVersion?: string
          }>
          MeasurementUnitsCodeSequence: Array<{
            CodeValue: string
            CodeMeaning: string
            CodingSchemeDesignator: string
            CodingSchemeVersion?: string
          }>
          MeasurementValuesSequence: Array<{
            FloatingPointValues?: string // FIXME: bytes
            AnnotationIndexList?: string // FIXME: bytes
          }>
        }>
      }>
    }

    export interface ParametricMap extends SOPClass {
      // Floating Point Image Pixel or Double Floating Point Image Pixel module
      BitsAllocated: number
      // Frame of Reference module
      FrameOfReferenceUID: string
      // Specimen module
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.coding.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
    }

    export interface Segmentation extends SOPClass {
      // Image Pixel module
      BitsAllocated: number
      // Frame of Reference module
      FrameOfReferenceUID: string
      // Specimen module
      ContainerIdentifier: string
      ContainerTypeCodeSequence: dcmjs.sr.coding.CodedConcept[]
      SpecimenDescriptionSequence: SpecimenDescription[]
      // Segmentation Image module
      SegmentSequence: Array<{
        SegmentNumber: number
        SegmentLabel: string
        SegmentDescription?: string
        SegmentedPropertyCategoryCodeSequence: Array<{
          CodeValue: string
          CodeMeaning: string
          CodingSchemeDesignator: string
          CodingSchemeVersion?: string
        }>
        SegmentedPropertyTypeCodeSequence: Array<{
          CodeValue: string
          CodeMeaning: string
          CodingSchemeDesignator: string
          CodingSchemeVersion?: string
        }>
      }>
    }

    export interface AdvancedBlendingPresentationState extends SOPClass {
      AdvancedBlendingSequence: Array<{
        BlendingInputNumber: number
        // FIXME
        ReferencedImageSequence?: Array<{
          ReferencedSOPClassUID: string
          ReferencedSOPInstanceUID: string
        }>
        ReferencedInstanceSequence?: Array<{
          ReferencedSOPClassUID: string
          ReferencedSOPInstanceUID: string
        }>
        PaletteColorLookupTableSequence: Array<{
          RedPaletteColorLookupTableDescriptor: number[]
          GreenPaletteColorLookupTableDescriptor: number[]
          BluePaletteColorLookupTableDescriptor: number[]
          RedPaletteColorLookupTableData?: Uint16Array
          GreenPaletteColorLookupTableData?: Uint16Array
          BluePaletteColorLookupTableData?: Uint16Array
          SegmentedRedPaletteColorLookupTableData?: Uint16Array
          SegmentedGreenPaletteColorLookupTableData?: Uint16Array
          SegmentedBluePaletteColorLookupTableData?: Uint16Array
          PaletteColorLookupTableUID?: string
        }>
        SoftcopyVOILUTSequence: Array<{
          WindowCenter: number
          WindowWidth: number
        }>
        StudyInstanceUID: string
        SeriesInstanceUID: string
      }>
      BlendingDisplaySequence: Array<{
        BlendingDisplayInputSequence: Array<{
          BlendingInputNumber: number
        }>
        BlendingMode: string
      }>
      ContentLabel: string
      ContentCreatorName: string
      ContentDescription?: string
      ReferencedSeriesSequence: Array<{
        SeriesInstanceUID: string
        ReferencedInstanceSequence: Array<{
          ReferencedSOPClassUID: string
          ReferencedSOPInstanceUID: string
        }>
      }>
    }

    export function formatMetadata (metadata: object): {
      dataset: Dataset
      bulkDataMapping: { [keyword: string]: { vr: string, BulkDataURI: string }}
    }

  }

  declare namespace annotation {

    export interface AnnotationGroupOptions {
      uid: string
      number: number
      label: label
      algorithmType: string
      algorithmName: string
      propertyCategory: dcmjs.sr.coding.CodedConcept
      propertyType: dcmjs.sr.coding.CodedConcept
      studyInstanceUID: string
      seriesInstanceUID: string
      sopInstanceUIDs: string[]
    }

    export class AnnotationGroup {
      constructor (options: AnnotationGroupOptions)
      get uid (): string
      get number (): number
      get label (): string
      get algorithmType (): string
      get algorithmName (): string
      get propertyCategory (): dcmjs.sr.coding.CodedConcept
      get propertyType (): dcmjs.sr.coding.CodedConcept
      get studyInstanceUID (): string
      get seriesInstanceUID (): string
      get sopInstanceUIDs (): string[]
    }

  }

  declare namespace mapping {

    export interface ParameterMappingOptions {
      uid: string
      number: number
      label: label
      studyInstanceUID: string
      seriesInstanceUID: string
      sopInstanceUIDs: string[]
    }

    export class ParameterMapping {
      constructor (options: ParameterMappingOptions)
      get uid (): string
      get number (): number
      get label (): string
      get description (): string
      get studyInstanceUID (): string
      get seriesInstanceUID (): string
      get sopInstanceUIDs (): string[]
    }

  }

  declare namespace color {
    export interface PaletteColorLookupTableOptions {
      uid: string
      redDescriptor: number[]
      greenDescriptor: number[]
      blueDescriptor: number[]
      redData?: Unit8Array|Unit16Array
      greenData?: Unit8Array|Unit16Array
      blueData?: Unit8Array|Unit16Array
      redSegmentedData?: Unit8Array|Unit16Array
      greenSegmentedData?: Unit8Array|Unit16Array
      blueSegmentedData?: Unit8Array|Unit16Array
    }

    export class PaletteColorLookupTable {
      constructor (options: PaletteColorLookupTableOptions)
      get uid (): string
      get data (): number[][]
      get firstValueMapped (): number
    }
  }

  declare namespace opticalPath {

    export interface OpticalPathOptions {
      identifier: string
      description?: string
      illuminationType: object
      isMonochromatic: boolean
      illuminationColor?: object
      illuminationWaveLength?: string
      studyInstanceUID: string
      seriesInstanceUID: string
      sopInstanceUIDs: string[]
    }

    export class OpticalPath {
      constructor (options: OpticalPathOptions)
      get identifier (): string
      get description (): string | undefined
      get illuminationType (): dcmjs.sr.coding.CodedConcept
      get illuminationColor (): dcmjs.sr.coding.CodedConcept | undefined
      get illuminationWaveLength (): string | undefined
      get studyInstanceUID (): string
      get seriesInstanceUID (): string
      get sopInstanceUIDs (): string[]
      get isMonochromatic (): boolean
      get isColorable (): boolean
      get paletteColorLookupTableUID (): string
    }
  }

}
