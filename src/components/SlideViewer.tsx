import React from 'react'
import { Layout, Space, Checkbox, Descriptions, Divider, Select, Tooltip, message, Menu, Row } from 'antd'
import { CheckboxChangeEvent } from 'antd/es/checkbox'
import { UndoOutlined } from '@ant-design/icons'
import {
  FaCrosshairs,
  FaDrawPolygon,
  FaEye,
  FaEyeSlash,
  FaHandPaper,
  FaHandPointer,
  FaTrash,
  FaSave
} from 'react-icons/fa'
// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
// skipcq: JS-C1003
import * as dwc from 'dicomweb-client'
// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
import { withRouter } from '../utils/router'
import { StorageClasses } from '../data/uids'
import { CustomError, errorTypes } from '../utils/CustomError'
import { findContentItemsByName } from '../utils/sr'
import NotificationMiddleware, {
  NotificationMiddlewareContext
} from '../services/NotificationMiddleware'
import { adaptRoiToAnnotation } from '../services/RoiToAnnotationAdapter'
import { AnnotationSettings, AnnotationCategoryAndType } from '../types/annotations'
import {
  SlideViewerProps,
  SlideViewerState,
  StyleOptions,
  EvaluationOptions,
  Evaluation,
  Measurement
} from './SlideViewer/types'
import SlideViewerModals from './SlideViewer/SlideViewerModals'
import SlideViewerSidebar from './SlideViewer/SlideViewerSidebar'
import SlideViewerContent from './SlideViewer/SlideViewerContent'
import {
  buildKey,
  getRoiKey,
  areROIsEqual,
  formatRoiStyle
} from './SlideViewer/utils/roiUtils'
import {
  constructViewers,
  implementsTID1500,
  describesSpecimenSubject,
  containsROIAnnotations
} from './SlideViewer/utils/viewerUtils'
import {
  DEFAULT_ROI_STROKE_COLOR,
  DEFAULT_ROI_FILL_COLOR,
  DEFAULT_ROI_STROKE_WIDTH,
  DEFAULT_ROI_RADIUS,
  DEFAULT_ANNOTATION_OPACITY,
  DEFAULT_ANNOTATION_STROKE_COLOR,
  DEFAULT_ANNOTATION_COLOR_PALETTE
} from './SlideViewer/constants'
import AnnotationList from './AnnotationList'
import AnnotationGroupList from './AnnotationGroupList'
import Report, { MeasurementReport } from './Report'
import HoveredRoiTooltip from './HoveredRoiTooltip'
import generateReport from '../utils/generateReport'
import { runValidations } from '../contexts/ValidationContext'
import DicomMetadataStore from '../services/DICOMMetadataStore'
import SpecimenList from './SpecimenList'
import Equipment from './Equipment'
import OpticalPathList from './OpticalPathList'
import SegmentList from './SegmentList'
import MappingList from './MappingList'
import Btn from './Button'

/**
 * React component for interactive viewing of an individual digital slide,
 * which corresponds to one DICOM Series of DICOM Slide Microscopy images and
 * potentially one or more associated DICOM Series of DICOM SR documents.
 */
class SlideViewer extends React.Component<SlideViewerProps, SlideViewerState> {
  private readonly findingOptions: dcmjs.sr.coding.CodedConcept[] = []

  private readonly evaluationOptions: { [key: string]: EvaluationOptions[] } = {}

  private readonly measurements: Measurement[] = []

  private readonly geometryTypeOptions: { [key: string]: string[] } = {}

  private readonly volumeViewportRef: React.RefObject<HTMLDivElement>

  private readonly labelViewportRef: React.RefObject<HTMLDivElement>

  private volumeViewer: dmv.viewer.VolumeImageViewer

  private labelViewer?: dmv.viewer.LabelImageViewer

  private hoveredRois = [] as dmv.roi.ROI[]

  private lastPixel = [0, 0] as [number, number]

  private readonly keysDown = new Set<string>()

  private readonly defaultRoiStyle: dmv.viewer.ROIStyleOptions = {
    stroke: {
      color: DEFAULT_ROI_STROKE_COLOR,
      width: DEFAULT_ROI_STROKE_WIDTH
    },
    fill: {
      color: DEFAULT_ROI_FILL_COLOR
    },
    image: {
      circle: {
        fill: {
          color: DEFAULT_ROI_STROKE_COLOR
        },
        radius: DEFAULT_ROI_RADIUS
      }
    }
  }

  private roiStyles: {[key: string]: dmv.viewer.ROIStyleOptions} = {}

  private defaultAnnotationStyles: {
    [annotationUID: string]: StyleOptions
  } = {}

  private readonly selectionStrokeColor: number[] = [0, 153, 255]
  private readonly selectionFillColor: number[] = [255, 255, 255]

  private readonly selectedRoiStyle: dmv.viewer.ROIStyleOptions = {
    stroke: { color: [...this.selectionStrokeColor, 1], width: 3 },
    fill: { color: [...this.selectionFillColor, 0.5] },
    image: {
      circle: {
        radius: 5,
        fill: { color: [...this.selectionStrokeColor, 1] }
      }
    }
  }

  constructor (props: SlideViewerProps) {
    super(props)
    console.info(
      `view slide "${this.props.slide.containerIdentifier}": `,
      this.props.slide
    )
    const geometryTypeOptions = [
      'point',
      'circle',
      'box',
      'polygon',
      'line',
      'freehandpolygon',
      'freehandline'
    ]
    props.annotations.forEach((annotation: AnnotationSettings) => {
      const finding = new dcmjs.sr.coding.CodedConcept(annotation.finding)
      this.findingOptions.push(finding)
      const key = buildKey(finding)
      if (annotation.geometryTypes !== undefined) {
        this.geometryTypeOptions[key] = annotation.geometryTypes
      } else {
        this.geometryTypeOptions[key] = geometryTypeOptions
      }
      this.evaluationOptions[key] = []
      if (annotation.evaluations !== undefined) {
        annotation.evaluations.forEach(evaluation => {
          this.evaluationOptions[key].push({
            name: new dcmjs.sr.coding.CodedConcept(evaluation.name),
            values: evaluation.values.map(value => {
              return new dcmjs.sr.coding.CodedConcept(value)
            })
          })
        })
      }
      if (annotation.measurements !== undefined) {
        annotation.measurements.forEach(measurement => {
          this.measurements.push({
            name: new dcmjs.sr.coding.CodedConcept(measurement.name),
            value: undefined,
            unit: new dcmjs.sr.coding.CodedConcept(measurement.unit)
          })
        })
      }
      if (annotation.style !== null && annotation.style !== undefined) {
        this.roiStyles[key] = formatRoiStyle(annotation.style)
      } else {
        this.roiStyles[key] = this.defaultRoiStyle
      }
    })

    const { volumeViewer, labelViewer } = constructViewers({
      clients: this.props.clients,
      slide: this.props.slide,
      preload: this.props.preload
    })
    this.volumeViewer = volumeViewer
    this.labelViewer = labelViewer
    this.volumeViewportRef = React.createRef<HTMLDivElement>()
    this.labelViewportRef = React.createRef<HTMLDivElement>()

    /**
     * Deactivate all optical paths. Visibility will be set later, potentially
     * using based on available presentation state instances.
     */
    this.volumeViewer.getAllOpticalPaths().forEach(opticalPath => {
      this.volumeViewer.deactivateOpticalPath(opticalPath.identifier)
    })

    const [offset, size] = this.volumeViewer.boundingBox

    this.state = {
      selectedRoiUIDs: new Set(),
      visibleRoiUIDs: new Set(),
      visibleSegmentUIDs: new Set(),
      visibleMappingUIDs: new Set(),
      visibleAnnotationGroupUIDs: new Set(),
      visibleOpticalPathIdentifiers: new Set(),
      activeOpticalPathIdentifiers: new Set(),
      presentationStates: [],
      selectedFinding: undefined,
      selectedEvaluations: [],
      generatedReport: undefined,
      isLoading: false,
      isAnnotationModalVisible: false,
      isSelectedRoiModalVisible: false,
      isHoveredRoiTooltipVisible: false,
      hoveredRoiTooltipX: 0,
      hoveredRoiTooltipY: 0,
      hoveredRoiAttributes: [],
      isSelectedMagnificationValid: false,
      isReportModalVisible: false,
      isRoiDrawingActive: false,
      isRoiTranslationActive: false,
      isRoiModificationActive: false,
      isGoToModalVisible: false,
      isSelectedXCoordinateValid: false,
      isSelectedYCoordinateValid: false,
      selectedXCoordinate: undefined,
      validXCoordinateRange: [offset[0], offset[0] + size[0]],
      selectedYCoordinate: undefined,
      validYCoordinateRange: [offset[1], offset[1] + size[1]],
      selectedMagnification: undefined,
      areRoisHidden: false,
      selectedSeriesInstanceUID: undefined,
      pixelDataStatistics: {},
      selectedPresentationStateUID: this.props.selectedPresentationStateUID,
      loadingFrames: new Set(),
      isICCProfilesEnabled: true
    }
  }

  componentDidUpdate (
    previousProps: SlideViewerProps,
    previousState: SlideViewerState
  ): void {
    /** Fetch data and update the viewports if the route has changed (
     * i.e., if another series has been selected) or if the client has changed.
     */
    if (
      this.props.location.pathname !== previousProps.location.pathname ||
      this.props.studyInstanceUID !== previousProps.studyInstanceUID ||
      this.props.seriesInstanceUID !== previousProps.seriesInstanceUID ||
      this.props.slide !== previousProps.slide ||
      this.props.clients !== previousProps.clients
    ) {
      if (this.volumeViewportRef.current !== null && this.volumeViewportRef.current !== undefined) {
        this.volumeViewportRef.current.innerHTML = ''
      }
      this.volumeViewer.cleanup()
      if (this.labelViewer !== null && this.labelViewer !== undefined) {
        if (this.labelViewportRef.current !== null && this.labelViewportRef.current !== undefined) {
          this.labelViewportRef.current.innerHTML = ''
        }
        this.labelViewer.cleanup()
      }
      const { volumeViewer, labelViewer } = constructViewers({
        clients: this.props.clients,
        slide: this.props.slide,
        preload: this.props.preload
      })
      this.volumeViewer = volumeViewer
      this.labelViewer = labelViewer

      const activeOpticalPathIdentifiers: Set<string> = new Set()
      const visibleOpticalPathIdentifiers: Set<string> = new Set()
      this.volumeViewer.getAllOpticalPaths().forEach(opticalPath => {
        const identifier = opticalPath.identifier
        if (this.volumeViewer.isOpticalPathVisible(identifier)) {
          visibleOpticalPathIdentifiers.add(identifier)
        }
        if (this.volumeViewer.isOpticalPathActive(identifier)) {
          activeOpticalPathIdentifiers.add(identifier)
        }
      })

      const [offset, size] = this.volumeViewer.boundingBox

      this.setState({
        visibleRoiUIDs: new Set(),
        visibleSegmentUIDs: new Set(),
        visibleMappingUIDs: new Set(),
        visibleAnnotationGroupUIDs: new Set(),
        visibleOpticalPathIdentifiers,
        activeOpticalPathIdentifiers,
        presentationStates: [],
        loadingFrames: new Set(),
        validXCoordinateRange: [offset[0], offset[0] + size[0]],
        validYCoordinateRange: [offset[1], offset[1] + size[1]]
      })
      this.populateViewports()
    }
  }

  /**
   * Retrieve Presentation State instances that reference the any images of
   * the currently selected series.
   */
  loadPresentationStates = (): void => {
    console.info('search for Presentation State instances')
    const client = this.props.clients[
      StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE
    ]
    client.searchForInstances({
      studyInstanceUID: this.props.studyInstanceUID,
      queryParams: {
        Modality: 'PR'
      }
    }).then((matchedInstances: dwc.api.Instance[] | null): void => {
      if (matchedInstances === null || matchedInstances === undefined) {
        matchedInstances = []
      }
      matchedInstances.forEach((rawInstance: dwc.api.Instance, index: number) => {
        const { dataset } = dmv.metadata.formatMetadata(rawInstance)
        const instance = dataset as dmv.metadata.Instance
        console.info(`retrieve PR instance "${instance.SOPInstanceUID}"`)
        client.retrieveInstance({
          studyInstanceUID: this.props.studyInstanceUID,
          seriesInstanceUID: instance.SeriesInstanceUID,
          sopInstanceUID: instance.SOPInstanceUID
        }).then((retrievedInstance: dwc.api.Dataset): void => {
          const data = dcmjs.data.DicomMessage.readFile(retrievedInstance)
          const { dataset } = dmv.metadata.formatMetadata(data.dict)
          if (this.props.slide.areVolumeImagesMonochrome) {
            const presentationState = (
              dataset as
              unknown as
              dmv.metadata.AdvancedBlendingPresentationState
            )
            let doesMatch = false
            presentationState.AdvancedBlendingSequence.forEach(blendingItem => {
              doesMatch = this.props.slide.seriesInstanceUIDs.includes(
                blendingItem.SeriesInstanceUID
              )
            }
            )
            if (doesMatch) {
              console.info(
                'include Advanced Blending Presentation State instance ' +
                `"${presentationState.SOPInstanceUID}"`
              )
              if (
                index === 0 &&
                (this.props.selectedPresentationStateUID === null ||
                 this.props.selectedPresentationStateUID === undefined)
              ) {
                this.setPresentationState(presentationState)
              } else {
                if (
                  presentationState.SOPInstanceUID ===
                  this.props.selectedPresentationStateUID
                ) {
                  this.setPresentationState(presentationState)
                }
              }
              this.setState(state => {
                const mapping: {
                  [sopInstanceUID: string]:
                  dmv.metadata.AdvancedBlendingPresentationState
                } = {}
                state.presentationStates.forEach(instance => {
                  mapping[instance.SOPInstanceUID] = instance
                })
                mapping[presentationState.SOPInstanceUID] = presentationState
                return { presentationStates: Object.values(mapping) }
              })
            }
          } else {
            console.info(
              `ignore presentation state "${instance.SOPInstanceUID}", ` +
              'application of presentation states for color images ' +
              'has not (yet) been implemented'
            )
          }
        }).catch((error) => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.SLIM,
            new CustomError(
              errorTypes.VISUALIZATION,
              'Presentation State could not be loaded'
            )
          )
          console.error(
            'failed to load presentation state ' +
            `of SOP instance "${instance.SOPInstanceUID}" ` +
            `of series "${instance.SeriesInstanceUID}" ` +
            `of study "${this.props.studyInstanceUID}": `,
            error
          )
        })
      })
    }).catch((error) => {
      console.error(error)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.VISUALIZATION,
          'Presentation State could not be loaded'
        )
      )
    })
  }

  /**
   * Set presentation state as specified by a DICOM Presentation State instance.
   */
  setPresentationState = (
    presentationState: dmv.metadata.AdvancedBlendingPresentationState
  ): void => {
    const opticalPaths = this.volumeViewer.getAllOpticalPaths()
    console.info(
      `apply Presentation State instance "${presentationState.SOPInstanceUID}"`
    )
    const opticalPathStyles: {
      [opticalPathIdentifier: string]: {
        opacity: number
        paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
        limitValues?: number[]
      } | null
    } = {}
    opticalPaths.forEach(opticalPath => {
      // First, deactivate and hide all optical paths and reset style
      const identifier = opticalPath.identifier
      this.volumeViewer.hideOpticalPath(identifier)
      this.volumeViewer.deactivateOpticalPath(identifier)
      const style = this.volumeViewer.getOpticalPathDefaultStyle(identifier)
      this.volumeViewer.setOpticalPathStyle(identifier, style)

      presentationState.AdvancedBlendingSequence.forEach(blendingItem => {
        /**
         * Referenced Instance Sequence should be used instead of Referenced
         * Image Sequence, but that's easy to mix up and we have encountered
         * implementations that get it wrong.
         */
        let refInstanceItems = blendingItem.ReferencedInstanceSequence
        if (refInstanceItems === undefined) {
          refInstanceItems = blendingItem.ReferencedImageSequence
        }
        if (refInstanceItems === undefined) {
          return
        }
        refInstanceItems.forEach(imageItem => {
          const isReferenced = opticalPath.sopInstanceUIDs.includes(
            imageItem.ReferencedSOPInstanceUID
          ) as boolean
          if (isReferenced) {
            let paletteColorLUT
            if (blendingItem.PaletteColorLookupTableSequence !== null && blendingItem.PaletteColorLookupTableSequence !== undefined) {
              const cpLUTItem = blendingItem.PaletteColorLookupTableSequence[0]
              paletteColorLUT = new dmv.color.PaletteColorLookupTable({
                uid: (
                  cpLUTItem.PaletteColorLookupTableUID !== null && cpLUTItem.PaletteColorLookupTableUID !== undefined
                    ? cpLUTItem.PaletteColorLookupTableUID
                    : ''
                ),
                redDescriptor:
                  cpLUTItem.RedPaletteColorLookupTableDescriptor,
                greenDescriptor:
                  cpLUTItem.GreenPaletteColorLookupTableDescriptor,
                blueDescriptor:
                  cpLUTItem.BluePaletteColorLookupTableDescriptor,
                redData: (
                  (cpLUTItem.RedPaletteColorLookupTableData !== null && cpLUTItem.RedPaletteColorLookupTableData !== undefined)
                    ? new Uint16Array(
                      cpLUTItem.RedPaletteColorLookupTableData
                    )
                    : undefined
                ),
                greenData: (
                  (cpLUTItem.GreenPaletteColorLookupTableData !== null && cpLUTItem.GreenPaletteColorLookupTableData !== undefined)
                    ? new Uint16Array(
                      cpLUTItem.GreenPaletteColorLookupTableData
                    )
                    : undefined
                ),
                blueData: (
                  (cpLUTItem.BluePaletteColorLookupTableData !== null && cpLUTItem.BluePaletteColorLookupTableData !== undefined)
                    ? new Uint16Array(
                      cpLUTItem.BluePaletteColorLookupTableData
                    )
                    : undefined
                ),
                redSegmentedData: (
                  (cpLUTItem.SegmentedRedPaletteColorLookupTableData !== null && cpLUTItem.SegmentedRedPaletteColorLookupTableData !== undefined)
                    ? new Uint16Array(
                      cpLUTItem.SegmentedRedPaletteColorLookupTableData
                    )
                    : undefined
                ),
                greenSegmentedData: (
                  (cpLUTItem.SegmentedGreenPaletteColorLookupTableData !== null && cpLUTItem.SegmentedGreenPaletteColorLookupTableData !== undefined)
                    ? new Uint16Array(
                      cpLUTItem.SegmentedGreenPaletteColorLookupTableData
                    )
                    : undefined
                ),
                blueSegmentedData: (
                  (cpLUTItem.SegmentedBluePaletteColorLookupTableData !== null && cpLUTItem.SegmentedBluePaletteColorLookupTableData !== undefined)
                    ? new Uint16Array(
                      cpLUTItem.SegmentedBluePaletteColorLookupTableData
                    )
                    : undefined
                )
              })
            }

            let limitValues
            if (blendingItem.SoftcopyVOILUTSequence !== null && blendingItem.SoftcopyVOILUTSequence !== undefined) {
              const voiLUTItem = blendingItem.SoftcopyVOILUTSequence[0]
              const windowCenter = voiLUTItem.WindowCenter
              const windowWidth = voiLUTItem.WindowWidth
              limitValues = [
                windowCenter - windowWidth * 0.5,
                windowCenter + windowWidth * 0.5
              ]
            }

            opticalPathStyles[identifier] = {
              opacity: 1,
              paletteColorLookupTable: paletteColorLUT,
              limitValues: limitValues
            }
          }
        })
      })
    })

    const selectedOpticalPathIdentifiers: Set<string> = new Set()
    Object.keys(opticalPathStyles).forEach(identifier => {
      const styleOptions = opticalPathStyles[identifier]
      if (styleOptions !== null) {
        this.volumeViewer.setOpticalPathStyle(identifier, styleOptions)
        this.volumeViewer.activateOpticalPath(identifier)
        this.volumeViewer.showOpticalPath(identifier)
        selectedOpticalPathIdentifiers.add(identifier)
      } else {
        this.volumeViewer.hideOpticalPath(identifier)
        this.volumeViewer.deactivateOpticalPath(identifier)
      }
    })
    const searchParams = new URLSearchParams(this.props.location.search)
    searchParams.set('state', presentationState.SOPInstanceUID)
    this.props.navigate(
      {
        pathname: this.props.location.pathname,
        search: searchParams.toString()
      },
      { replace: true }
    )
    this.setState(state => ({
      activeOpticalPathIdentifiers: selectedOpticalPathIdentifiers,
      visibleOpticalPathIdentifiers: selectedOpticalPathIdentifiers,
      selectedPresentationStateUID: presentationState.SOPInstanceUID
    }))
  }

  getRoiStyle = (key?: string): dmv.viewer.ROIStyleOptions => {
    if (key === null || key === undefined) {
      return this.defaultRoiStyle
    }
    if (this.roiStyles[key] !== undefined) {
      return this.roiStyles[key]
    }
    return this.defaultRoiStyle
  }

  loadDerivedDataset = (derivedDataset: dmv.metadata.Dataset): void => {
    console.debug('Loading derived dataset')
    const Comprehensive3DSR = StorageClasses.COMPREHENSIVE_3D_SR
    const ComprehensiveSR = StorageClasses.COMPREHENSIVE_SR
    const MicroscopyBulkSimpleAnnotation = StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION
    const Segmentation = StorageClasses.SEGMENTATION
    const ParametricMap = StorageClasses.PARAMETRIC_MAP
    const OpticalPath = StorageClasses.OPTICAL_PATH
    const AdvancedBlendingPresentationState = StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE
    const ColorSoftcopyPresentationState = StorageClasses.COLOR_SOFTCOPY_PRESENTATION_STATE
    const GrayscaleSoftcopyPresentationState = StorageClasses.GRAYSCALE_SOFTCOPY_PRESENTATION_STATE
    const PseudocolorSoftcopyPresentationState = StorageClasses.PSEUDOCOLOR_SOFTCOPY_PRESENTATION_STATE

    if ((derivedDataset as { SOPClassUID: string }).SOPClassUID === Comprehensive3DSR) {
      const allRois = this.volumeViewer.getAllROIs()
      allRois.forEach((roi) => {
        this.handleAnnotationVisibilityChange({ roiUID: roi.uid, isVisible: true })
      })
      console.debug('Loading Comprehensive 3D SR')
    } else if ((derivedDataset as { SOPClassUID: string }).SOPClassUID === MicroscopyBulkSimpleAnnotation) {
      const allAnnotationGroups = this.volumeViewer.getAllAnnotationGroups()
      allAnnotationGroups.forEach((annotationGroup) => {
        this.handleAnnotationGroupVisibilityChange({ annotationGroupUID: annotationGroup.uid, isVisible: true })
      })
      console.debug('Loading Microscopy Bulk Simple Annotation')
    } else if ((derivedDataset as { SOPClassUID: string }).SOPClassUID === Segmentation) {
      const allSegments = this.volumeViewer.getAllSegments()
      allSegments.forEach((segment) => {
        this.handleSegmentVisibilityChange({ segmentUID: segment.uid, isVisible: true })
      })
      console.debug('Loading Segmentation')
    } else if ((derivedDataset as { SOPClassUID: string }).SOPClassUID === ParametricMap) {
      const allParameterMappings = this.volumeViewer.getAllParameterMappings()
      allParameterMappings.forEach((parameterMapping) => {
        this.handleMappingVisibilityChange({ mappingUID: parameterMapping.uid, isVisible: true })
      })
      console.debug('Loading Parametric Map')
    } else if ((derivedDataset as { SOPClassUID: string }).SOPClassUID === OpticalPath) {
      const allOpticalPaths = this.volumeViewer.getAllOpticalPaths()
      allOpticalPaths.forEach((opticalPath) => {
        this.handleOpticalPathVisibilityChange({ opticalPathIdentifier: opticalPath.identifier, isVisible: true })
      })
      console.debug('Loading Optical Path')
    } else if ((derivedDataset as { SOPClassUID: string }).SOPClassUID === ComprehensiveSR) {
      console.debug('TODO: Loading Comprehensive SR')
    } else if ((derivedDataset as { SOPClassUID: string }).SOPClassUID === AdvancedBlendingPresentationState) {
      console.debug('TODO: Loading Advanced Blending Presentation State')
    } else if ((derivedDataset as { SOPClassUID: string }).SOPClassUID === ColorSoftcopyPresentationState) {
      console.debug('TODO: Loading Color Softcopy Presentation State')
    } else if ((derivedDataset as { SOPClassUID: string }).SOPClassUID === GrayscaleSoftcopyPresentationState) {
      console.debug('TODO: Loading Grayscale Softcopy Presentation State')
    } else if ((derivedDataset as { SOPClassUID: string }).SOPClassUID === PseudocolorSoftcopyPresentationState) {
      console.debug('TODO: Loading Pseudocolor Softcopy Presentation State')
    }
  }

  /**
   * Retrieve Structured Report instances that contain regions of interests
   * with 3D spatial coordinates defined in the same frame of reference as the
   * currently selected series and add them to the VOLUME image viewer.
   */
  async addAnnotations (): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      console.info('search for Comprehensive 3D SR instances')
      const client = this.props.clients[StorageClasses.COMPREHENSIVE_3D_SR]
      client.searchForInstances({
        studyInstanceUID: this.props.studyInstanceUID,
        queryParams: {
          Modality: 'SR'
        }
      }).then((matchedInstances): void => {
        if (matchedInstances === null || matchedInstances === undefined) {
          matchedInstances = []
        }
        matchedInstances.forEach(i => {
          const { dataset } = dmv.metadata.formatMetadata(i)
          const instance = dataset as dmv.metadata.Instance
          if (instance.SOPClassUID === StorageClasses.COMPREHENSIVE_3D_SR) {
            console.info(`retrieve SR instance "${instance.SOPInstanceUID}"`)
            client.retrieveInstance({
              studyInstanceUID: this.props.studyInstanceUID,
              seriesInstanceUID: instance.SeriesInstanceUID,
              sopInstanceUID: instance.SOPInstanceUID
            }).then((retrievedInstance): void => {
              const data = dcmjs.data.DicomMessage.readFile(retrievedInstance)
              const { dataset } = dmv.metadata.formatMetadata(data.dict)
              const report = dataset as unknown as dmv.metadata.Comprehensive3DSR
              /*
              * Perform a couple of checks to ensure the document content of the
              * report fullfils the requirements of the application.
              */
              if (!implementsTID1500(report)) {
                console.debug(
                  `ignore SR document "${report.SOPInstanceUID}" ` +
                  'because it is not structured according to template ' +
                  'TID 1500 "MeasurementReport"'
                )
                return
              }
              if (!describesSpecimenSubject(report)) {
                console.debug(
                  `ignore SR document "${report.SOPInstanceUID}" ` +
                  'because it does not describe a specimen subject'
                )
                return
              }
              if (!containsROIAnnotations(report)) {
                console.debug(
                  `ignore SR document "${report.SOPInstanceUID}" ` +
                  'because it does not contain any suitable ROI annotations'
                )
                return
              }

              const content = new MeasurementReport(report)
              content.ROIs.forEach(roi => {
                console.info(`add ROI "${roi.uid}"`)
                const scoord3d = roi.scoord3d
                const image = this.props.slide.volumeImages[0]
                if (scoord3d.frameOfReferenceUID === image.FrameOfReferenceUID) {
                  /*
                  * ROIs may get assigned new UIDs upon re-rendering of the
                  * page and we need to ensure that we don't add them twice.
                  * The same ROI may be stored in multiple SR documents and
                  * we don't want them to show up twice.
                  * TODO: We should probably either "merge" measurements and
                  * quantitative evaluations or pick the ROI from the "best"
                  * available report (COMPLETE and VERIFIED).
                  */
                  const doesROIExist = this.volumeViewer.getAllROIs().some(
                    (otherROI: dmv.roi.ROI): boolean => {
                      return areROIsEqual(otherROI, roi)
                    }
                  )
                  if (!doesROIExist) {
                    try {
                      // Add ROI without style such that it won't be visible.
                      this.volumeViewer.addROI(roi, {})
                      const roiAsAnnotation = adaptRoiToAnnotation(roi)
                      this.formatAnnotation(roiAsAnnotation)
                    } catch {
                      console.error(`could not add ROI "${roi.uid}"`)
                    }
                  } else {
                    console.debug(`skip already existing ROI "${roi.uid}"`)
                  }
                } else {
                  console.debug(
                    `skip ROI "${roi.uid}" ` +
                    `of SR document "${report.SOPInstanceUID}"` +
                    'because it is defined in another frame of reference'
                  )
                }
              })

              resolve()
            }).catch((error) => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              NotificationMiddleware.onError(
                NotificationMiddlewareContext.SLIM,
                new CustomError(
                  errorTypes.VISUALIZATION,
                  'Annotations could not be loaded'
                )
              )
              console.error(
                'failed to load ROIs ' +
                `of SOP instance "${instance.SOPInstanceUID}" ` +
                `of series "${instance.SeriesInstanceUID}" ` +
                `of study "${this.props.studyInstanceUID}": `,
                error
              )
            })
            /*
            * React is not aware of the fact that ROIs have been added via the
            * viewer (the viewport is a ref object) and won't show the
            * annotations in the user interface unless an update is forced.
            */
            this.forceUpdate()
          }
        })
      }).catch((error) => {
        console.error(error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Annotations could not be loaded'
          )
        )
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  /**
   * Retrieve Microscopy Bulk Simple Annotations instances that contain
   * annotation groups defined in the same frame of reference as the currently
   * selected series and add them to the VOLUME image viewer.
   */
  addAnnotationGroups = async (): Promise<void> => {
    return await new Promise<void>((resolve, reject) => {
      console.info('search for Microscopy Bulk Simple Annotations instances')
      const client = this.props.clients[
        StorageClasses.MICROSCOPY_BULK_SIMPLE_ANNOTATION
      ]
      client.searchForSeries({
        studyInstanceUID: this.props.studyInstanceUID,
        queryParams: {
          Modality: 'ANN'
        }
      }).then((matchedSeries): void => {
        if (matchedSeries === null || matchedSeries === undefined) {
          matchedSeries = []
        }
        matchedSeries.forEach(s => {
          const { dataset } = dmv.metadata.formatMetadata(s)
          const series = dataset as dmv.metadata.Series
          client.retrieveSeriesMetadata({
            studyInstanceUID: this.props.studyInstanceUID,
            seriesInstanceUID: series.SeriesInstanceUID
          }).then((retrievedMetadata): void => {
            const annotations: dmv.metadata.MicroscopyBulkSimpleAnnotations[] = retrievedMetadata.map(metadata => {
              return new dmv.metadata.MicroscopyBulkSimpleAnnotations({
                metadata
              })
            })
            // annotations = annotations.filter(ann => {
            //   const refImage = this.props.slide.volumeImages[0]
            //   return (
            //     ann.FrameOfReferenceUID === refImage.FrameOfReferenceUID &&
            //     ann.ContainerIdentifier === refImage.ContainerIdentifier
            //   )
            // })
            annotations.forEach(ann => {
              try {
                this.volumeViewer.addAnnotationGroups(ann)
              } catch (error: unknown) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                NotificationMiddleware.onError(
                  NotificationMiddlewareContext.SLIM,
                  new CustomError(
                    errorTypes.VISUALIZATION,
                    'Microscopy Bulk Simple Annotations cannot be displayed.'
                  )
                )
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                console.error('failed to add annotation groups:', error)
              }
              ann.AnnotationGroupSequence.forEach(item => {
                const annotationGroupUID = item.AnnotationGroupUID
                const finding = item.AnnotationPropertyTypeCodeSequence[0]
                const key = buildKey(finding)
                const style = this.roiStyles[key]
                // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
                if (style !== null && style !== undefined && style.fill !== null && style.fill !== undefined) {
                  this.volumeViewer.setAnnotationGroupStyle(
                    annotationGroupUID,
                    { color: style.fill.color }
                  )
                }
              })
            })
            /*
            * React is not aware of the fact that annotation groups have been
            * added via the viewer (the underlying HTML viewport element is a
            * ref object) and won't show the annotation groups in the user
            * interface unless an update is forced.
            */
            this.forceUpdate()
            resolve()
          }).catch((error) => {
            console.error(error)
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            NotificationMiddleware.onError(
              NotificationMiddlewareContext.SLIM,
              new CustomError(
                errorTypes.VISUALIZATION,
                'Retrieval of metadata of Microscopy Bulk Simple Annotations ' +
                'instances failed.'
              )
            )
          })
        })
      }).catch((error) => {
        console.error(error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Search for Microscopy Bulk Simple Annotations instances failed.'
          )
        )
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  /**
   * Retrieve Segmentation instances that contain segments defined in the same
   * frame of reference as the currently selected series and add them to the
   * VOLUME image viewer.
   */
  addSegmentations = async (): Promise<void> => {
    return await new Promise<void>((resolve, reject) => {
      console.info('search for Segmentation instances')
      const client = this.props.clients[StorageClasses.SEGMENTATION]
      client.searchForSeries({
        studyInstanceUID: this.props.studyInstanceUID,
        queryParams: {
          Modality: 'SEG'
        }
      }).then((matchedSeries): void => {
        if (matchedSeries === null || matchedSeries === undefined) {
          matchedSeries = []
        }
        matchedSeries.forEach((s, i) => {
          const { dataset } = dmv.metadata.formatMetadata(s)
          const series = dataset as dmv.metadata.Series
          client.retrieveSeriesMetadata({
            studyInstanceUID: this.props.studyInstanceUID,
            seriesInstanceUID: series.SeriesInstanceUID
          }).then((retrievedMetadata): void => {
            const segmentations: dmv.metadata.Segmentation[] = []
            retrievedMetadata.forEach(metadata => {
              const seg = new dmv.metadata.Segmentation({ metadata })
              const refImage = this.props.slide.volumeImages[0]
              if (
                seg.FrameOfReferenceUID === refImage.FrameOfReferenceUID &&
                seg.ContainerIdentifier === refImage.ContainerIdentifier
              ) {
                segmentations.push(seg)
              }
            })
            if (segmentations.length > 0) {
              try {
                this.volumeViewer.addSegments(segmentations)
              } catch (error: unknown) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                NotificationMiddleware.onError(
                  NotificationMiddlewareContext.SLIM,
                  new CustomError(
                    errorTypes.VISUALIZATION,
                    'Segmentations cannot be displayed'
                  )
                )
                console.error('failed to add segments: ', error)
              }
              /*
              * React is not aware of the fact that segments have been added via
              * the viewer (the underlying HTML viewport element is a ref object)
              * and won't show the segments in the user interface unless an update
              * is forced.
              */
              this.forceUpdate()
            }

            resolve()
          }).catch((error) => {
            console.error(error)
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            NotificationMiddleware.onError(
              NotificationMiddlewareContext.SLIM,
              new CustomError(
                errorTypes.VISUALIZATION,
                'Retrieval of metadata of Segmentation instances failed.'
              )
            )
          })
        })
      }).catch((error) => {
        console.error(error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Search for Segmentation instances failed.'
          )
        )
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  /**
   * Retrieve Parametric Map instances that contain mappings defined in the same
   * frame of reference as the currently selected series and add them to the
   * VOLUME image viewer.
   */
  addParametricMaps = async (): Promise<void> => {
    return await new Promise<void>((resolve, reject) => {
      console.info('search for Parametric Map instances')
      const client = this.props.clients[StorageClasses.PARAMETRIC_MAP]
      client.searchForSeries({
        studyInstanceUID: this.props.studyInstanceUID,
        queryParams: {
          Modality: 'OT'
        }
      }).then((matchedSeries): void => {
        if (matchedSeries === null || matchedSeries === undefined) {
          matchedSeries = []
        }
        matchedSeries.forEach(s => {
          const { dataset } = dmv.metadata.formatMetadata(s)
          const series = dataset as dmv.metadata.Series
          client.retrieveSeriesMetadata({
            studyInstanceUID: this.props.studyInstanceUID,
            seriesInstanceUID: series.SeriesInstanceUID
          }).then((retrievedMetadata): void => {
            const parametricMaps: dmv.metadata.ParametricMap[] = []
            retrievedMetadata.forEach(metadata => {
              const pm = new dmv.metadata.ParametricMap({ metadata })
              const refImage = this.props.slide.volumeImages[0]
              if (
                pm.FrameOfReferenceUID === refImage.FrameOfReferenceUID &&
                pm.ContainerIdentifier === refImage.ContainerIdentifier
              ) {
                parametricMaps.push(pm)
              } else {
                console.warn(
                  `skip Parametric Map instance "${pm.SOPInstanceUID}"`
                )
              }
            })
            if (parametricMaps.length > 0) {
              try {
                this.volumeViewer.addParameterMappings(parametricMaps)
              } catch (error: unknown) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                NotificationMiddleware.onError(
                  NotificationMiddlewareContext.SLIM,
                  new CustomError(
                    errorTypes.VISUALIZATION,
                    'Parametric Map cannot be displayed'
                  )
                )
                console.error('failed to add mappings: ', error)
              }
              /*
               * React is not aware of the fact that mappings have been added via
               * the viewer (the underlying HTML viewport element is a ref object)
               * and won't show the mappings in the user interface unless an update
               * is forced.
               */
              this.forceUpdate()
            }
            resolve()
          }).catch((error) => {
            console.error(error)
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            NotificationMiddleware.onError(
              NotificationMiddlewareContext.SLIM,
              new CustomError(
                errorTypes.VISUALIZATION,
                'Retrieval of metadata of Parametric Map instances failed.'
              )
            )
          })
        })
      }).catch((error) => {
        console.error(error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Search for Parametric Map instances failed.'
          )
        )
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  /**
   * Populate viewports of the VOLUME and LABEL image viewers.
   */
  populateViewports = (): void => {
    console.info('populate viewports...')
    this.setState({
      isLoading: true,
      presentationStates: []
    })

    if (this.volumeViewportRef.current !== null) {
      this.volumeViewer.render({ container: this.volumeViewportRef.current })
    }
    if (
      this.labelViewportRef.current !== null &&
      this.labelViewer !== null && this.labelViewer !== undefined
    ) {
      this.labelViewer.render({ container: this.labelViewportRef.current })
    }

    // State update will also ensure that the component is re-rendered.
    this.setState({ isLoading: false })

    this.setDefaultPresentationState()
    this.loadPresentationStates()

    // Handle promises properly with catch blocks
    void this.addAnnotations()
      .then(() => {
        if (this.props.derivedDataset !== null && this.props.derivedDataset !== undefined) {
          this.loadDerivedDataset(this.props.derivedDataset)
        }
      })
      .catch(error => {
        console.error('Failed to add annotations:', error)
      })

    void this.addAnnotationGroups()
      .then(() => {
        if (this.props.derivedDataset !== null && this.props.derivedDataset !== undefined) {
          this.loadDerivedDataset(this.props.derivedDataset)
        }
      })
      .catch(error => {
        console.error('Failed to add annotation groups:', error)
      })

    void this.addSegmentations()
      .then(() => {
        if (this.props.derivedDataset !== null && this.props.derivedDataset !== undefined) {
          this.loadDerivedDataset(this.props.derivedDataset)
        }
      })
      .catch(error => {
        console.error('Failed to add segmentations:', error)
      })

    void this.addParametricMaps()
      .then(() => {
        if (this.props.derivedDataset !== null && this.props.derivedDataset !== undefined) {
          this.loadDerivedDataset(this.props.derivedDataset)
        }
      })
      .catch(error => {
        console.error('Failed to add parametric maps:', error)
      })
  }

  onRoiModified = (event: CustomEventInit): void => {
    // Update state to trigger rendering
    this.setState(state => ({
      visibleRoiUIDs: new Set(state.visibleRoiUIDs)
    }))
  }

  onWindowResize = (event: Event): void => {
    console.info('resize viewports')
    this.volumeViewer.resize()
    if (this.labelViewer !== null && this.labelViewer !== undefined) {
      this.labelViewer.resize()
    }
  }

  onRoiDrawn = (event: CustomEventInit): void => {
    const roi = event.detail.payload as dmv.roi.ROI
    const selectedFinding = this.state.selectedFinding
    const selectedEvaluations = this.state.selectedEvaluations
    if (roi !== undefined && selectedFinding !== undefined) {
      console.debug(`add ROI "${roi.uid}"`)
      const findingItem = new dcmjs.sr.valueTypes.CodeContentItem({
        name: new dcmjs.sr.coding.CodedConcept({
          value: '121071',
          meaning: 'Finding',
          schemeDesignator: 'DCM'
        }),
        value: selectedFinding,
        relationshipType: 'CONTAINS'
      })
      roi.addEvaluation(findingItem)
      selectedEvaluations.forEach((evaluation: Evaluation) => {
        const item = new dcmjs.sr.valueTypes.CodeContentItem({
          name: evaluation.name,
          value: evaluation.value,
          relationshipType: 'CONTAINS'
        })
        roi.addEvaluation(item)
      })
      const key = buildKey(selectedFinding)
      const style = this.getRoiStyle(key)
      this.volumeViewer.addROI(roi, style)
      this.setState(state => {
        const visibleRoiUIDs = state.visibleRoiUIDs
        visibleRoiUIDs.add(roi.uid)
        return { visibleRoiUIDs }
      })
    } else {
      console.debug(`could not add ROI "${roi.uid}"`)
    }
  }

  onRoiDoubleClicked = (event: CustomEventInit): void => {
    const selectedRoi = event.detail.payload as dmv.roi.ROI
    if (selectedRoi !== null) {
      this.setState({
        isSelectedRoiModalVisible: true
      })
    } else {
      this.setState({
        isSelectedRoiModalVisible: false
      })
    }
  }

  setHoveredRoiAttributes = (hoveredRois: dmv.roi.ROI[]): void => {
    const rois = this.volumeViewer.getAllROIs()
    if (rois.length === 0) {
      this.setState({ hoveredRoiAttributes: [] })
      return
    }

    const result = hoveredRois.map((roi) => {
      const attributes: Array<{ name: string, value: string }> = []
      const evaluations = roi.evaluations
      evaluations.forEach((
        item: (
          dcmjs.sr.valueTypes.TextContentItem |
          dcmjs.sr.valueTypes.CodeContentItem
        )
      ) => {
        const nameValue = item.ConceptNameCodeSequence[0].CodeValue
        const nameMeaning = item.ConceptNameCodeSequence[0].CodeMeaning
        const name = `${nameMeaning}`
        if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.CODE) {
          const codeContentItem = item as dcmjs.sr.valueTypes.CodeContentItem
          const valueMeaning = codeContentItem.ConceptCodeSequence[0].CodeMeaning
          // For consistency with Segment and Annotation Group
          if (nameValue === '276214006') {
            attributes.push({
              name: 'Property category',
              value: `${valueMeaning}`
            })
          } else if (nameValue === '121071') {
            attributes.push({
              name: 'Property type',
              value: `${valueMeaning}`
            })
          } else if (nameValue === '111001') {
            attributes.push({
              name: 'Algorithm Name',
              value: `${valueMeaning}`
            })
          } else {
            attributes.push({
              name: name,
              value: `${valueMeaning}`
            })
          }
        } else if (item.ValueType === dcmjs.sr.valueTypes.ValueTypes.TEXT) {
          const textContentItem = item as dcmjs.sr.valueTypes.TextContentItem
          attributes.push({
            name: name,
            value: textContentItem.TextValue
          })
        }
      })

      const index = (rois.findIndex((r) => r.uid === roi.uid) ?? 0) + 1
      return { index, roiUid: roi.uid, attributes }
    }, [] as Array<dcmjs.sr.valueTypes.CodeContentItem | dcmjs.sr.valueTypes.TextContentItem>)

    this.setState({ hoveredRoiAttributes: result })
  }

  clearHoveredRois = (): void => {
    this.hoveredRois = [] as any
  }

  getUniqueHoveredRois = (newRoi: dmv.roi.ROI | null): dmv.roi.ROI[] => {
    if (newRoi === null || newRoi === undefined) {
      return this.hoveredRois
    }
    const allRois = [...this.hoveredRois, newRoi]
    const uniqueIds = Array.from(new Set(allRois.map(roi => roi.uid)))
    return uniqueIds.map(id => allRois.find(roi => roi.uid === id))
      .filter((roi): roi is dmv.roi.ROI => roi !== undefined)
  }

  isSamePixelAsLast = (event: MouseEvent): boolean => {
    return event.clientX === this.lastPixel[0] && event.clientY === this.lastPixel[1]
  }

  onPointerMove = (event: CustomEventInit): void => {
    const { feature: hoveredRoi, event: evt } = event.detail.payload
    const originalEvent = evt.originalEvent

    if (!this.isSamePixelAsLast(originalEvent)) {
      this.lastPixel = [originalEvent.clientX, originalEvent.clientY]
      this.clearHoveredRois()
    }

    this.hoveredRois = this.getUniqueHoveredRois(hoveredRoi)

    if (this.hoveredRois.length > 0) {
      this.setHoveredRoiAttributes(this.hoveredRois)
      this.setState({
        isHoveredRoiTooltipVisible: true,
        hoveredRoiTooltipX: originalEvent.clientX,
        hoveredRoiTooltipY: originalEvent.clientY
      })
    } else {
      this.setState({
        isHoveredRoiTooltipVisible: false
      })
    }
  }

  getUpdatedSelectedRois = (newSelectedRoiUid?: string): { selectedRoiUIDs: Set<string>, selectedRoi?: dmv.roi.ROI} => {
    const selectedRoiUid = newSelectedRoiUid
    const emptySelection = {
      selectedRoiUIDs: new Set<string>(),
      selectedRoi: undefined
    }

    if (selectedRoiUid === undefined) {
      return emptySelection
    }

    const selectedRoi = this.volumeViewer.getROI(selectedRoiUid)
    if (selectedRoi === undefined) {
      return emptySelection
    }

    console.debug(`selected ROI "${selectedRoi.uid}"`)

    if (!this.keysDown.has('Shift')) {
      return {
        selectedRoiUIDs: new Set([selectedRoi.uid]),
        selectedRoi
      }
    }

    const oldSelectedRois = Array.from(this.state.selectedRoiUIDs)
    return {
      selectedRoiUIDs: new Set([...oldSelectedRois, selectedRoi.uid]),
      selectedRoi
    }
  }

  resetUnselectedRoiStyles = (selectionState: { selectedRoiUIDs: Set<string> }): void => {
    this.volumeViewer.getAllROIs().forEach(roi => {
      const uid = roi.uid

      if (selectionState.selectedRoiUIDs.has(uid) || !this.state.visibleRoiUIDs.has(uid)) {
        return
      }

      const key = getRoiKey(roi)
      const style = this.getRoiStyle(key)
      this.volumeViewer.setROIStyle(uid, style)
    })
  }

  onMapClicked = (event: CustomEventInit): void => {
    const roisClicked = (event.detail?.payload?.rois ?? []) as dmv.roi.ROI[]

    if (roisClicked.length !== 0) {
      return
    }

    const updatedSelectedRois = this.getUpdatedSelectedRois()
    this.setState(updatedSelectedRois)

    // @ts-expect-error
    this.volumeViewer.clearSelections()

    this.resetUnselectedRoiStyles(updatedSelectedRois)
  }

  onRoiSelected = (event: CustomEventInit): void => {
    const selectedRoiUid = event.detail?.payload?.uid as string
    const updatedSelectedRois = this.getUpdatedSelectedRois(selectedRoiUid)
    this.setState(updatedSelectedRois)

    this.resetUnselectedRoiStyles(updatedSelectedRois)
  }

  handleAnnotationSelection = (uid: string): void => {
    // @ts-expect-error
    this.volumeViewer.clearSelections()

    const updatedSelectedRois = this.getUpdatedSelectedRois(uid)
    this.setState(updatedSelectedRois)
    this.volumeViewer.getAllROIs().forEach((roi) => {
      let style = {}
      if (updatedSelectedRois.selectedRoiUIDs.has(roi.uid)) {
        style = this.selectedRoiStyle
        this.setState(state => {
          const visibleRoiUIDs = state.visibleRoiUIDs
          visibleRoiUIDs.add(roi.uid)
          return { visibleRoiUIDs }
        })
      } else {
        if (this.state.visibleRoiUIDs.has(roi.uid)) {
          const key = getRoiKey(roi)
          style = this.getRoiStyle(key)
        }
      }
      this.volumeViewer.setROIStyle(roi.uid, style)
    })
  }

  handleRoiSelectionCancellation = (): void => {
    console.info('cancel ROI selection')
    this.setState({
      isSelectedRoiModalVisible: false
    })
  }

  onLoadingStarted = (event: CustomEventInit): void => {
    this.setState({ isLoading: true })
  }

  onLoadingEnded = (event: CustomEventInit): void => {
    this.setState({ isLoading: false })
  }

  onFrameLoadingStarted = (event: CustomEventInit): void => {
    const frameInfo: {
      studyInstanceUID: string
      seriesInstanceUID: string
      sopInstanceUID: string
      sopClassUID: string
      frameNumber: string
      channelIdentifier: string
    } = event.detail.payload
    const key: string = `${frameInfo.sopInstanceUID}-${frameInfo.frameNumber}`
    this.setState(state => {
      state.loadingFrames.add(key)
      return state
    })
  }

  onFrameLoadingError = (event: CustomEventInit): void => {
    console.error('Failed to load frame')
  }

  onLoadingError = (event: CustomEventInit): void => {
    const message = (event.detail?.payload?.message ?? 'Failed to load data') as string
    console.error(message)
    NotificationMiddleware.onError(
      NotificationMiddlewareContext.SLIM,
      new CustomError(
        errorTypes.VISUALIZATION,
        message
      ) as any
    )
  }

  onFrameLoadingEnded = (event: CustomEventInit): void => {
    const frameInfo: {
      studyInstanceUID: string
      seriesInstanceUID: string
      sopInstanceUID: string
      sopClassUID: string
      frameNumber: string
      channelIdentifier: string
      pixelArray: Uint8Array|Uint16Array|Float32Array|null
    } = event.detail.payload
    const key = `${frameInfo.sopInstanceUID}-${frameInfo.frameNumber}`
    this.setState(state => {
      state.loadingFrames.delete(key)
      let isLoading: boolean = false
      if (state.loadingFrames.size > 0) {
        isLoading = true
      }
      return {
        isLoading,
        loadingFrames: state.loadingFrames
      }
    })
    if (
      frameInfo.sopClassUID === StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE &&
      this.props.slide.areVolumeImagesMonochrome
    ) {
      const opticalPathIdentifier = frameInfo.channelIdentifier
      if (
        !(opticalPathIdentifier in this.state.pixelDataStatistics) &&
        frameInfo.pixelArray !== null
      ) {
        /*
         * There are limits on the number of arguments Math.min and Math.max
         * functions can accept. Therefore, we compute values in smaller chunks.
         */
        const size = 2 ** 16
        const chunks = Math.ceil(frameInfo.pixelArray.length / size)
        let offset = 0
        const minValues: number[] = []
        const maxValues: number[] = []
        for (let i = 0; i < chunks; i++) {
          offset = i * size
          const pixels = frameInfo.pixelArray.slice(offset, offset + size)
          minValues.push(Math.min(...pixels))
          maxValues.push(Math.max(...pixels))
        }
        const min = Math.min(...minValues)
        const max = Math.max(...maxValues)
        this.setState(state => {
          const stats = state.pixelDataStatistics
          if (stats[opticalPathIdentifier] !== null && stats[opticalPathIdentifier] !== undefined) {
            stats[opticalPathIdentifier] = {
              min: Math.min(stats[opticalPathIdentifier].min, min),
              max: Math.max(stats[opticalPathIdentifier].max, max),
              numFramesSampled: stats[opticalPathIdentifier].numFramesSampled + 1
            }
          } else {
            stats[opticalPathIdentifier] = {
              min: min,
              max: max,
              numFramesSampled: 1
            }
          }
          if (state.selectedPresentationStateUID === null || state.selectedPresentationStateUID === undefined) {
            const style = {
              ...this.volumeViewer.getOpticalPathStyle(opticalPathIdentifier)
            }
            style.limitValues = [
              stats[opticalPathIdentifier].min,
              stats[opticalPathIdentifier].max
            ]
            this.volumeViewer.setOpticalPathStyle(opticalPathIdentifier, style)
          }
          return state
        })
      }
    }
  }

  onRoiRemoved = (event: CustomEventInit): void => {
    const roi = event.detail.payload as dmv.roi.ROI
    console.debug(`removed ROI "${roi.uid}"`)
  }

  componentCleanup = (): void => {
    document.body.removeEventListener(
      'dicommicroscopyviewer_roi_drawn',
      this.onRoiDrawn
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_viewport_clicked',
      this.onMapClicked
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_roi_selected',
      this.onRoiSelected
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_roi_double_clicked',
      this.onRoiDoubleClicked
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_pointer_move',
      this.onPointerMove
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_roi_removed',
      this.onRoiRemoved
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_roi_modified',
      this.onRoiModified
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_loading_started',
      this.onLoadingStarted
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_loading_ended',
      this.onLoadingEnded
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_frame_loading_started',
      this.onFrameLoadingStarted
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_frame_loading_ended',
      this.onFrameLoadingEnded
    )
    document.body.removeEventListener(
      'keyup',
      this.onKeyUp
    )
    document.body.removeEventListener(
      'keyup',
      this.onKeyDown
    )
    window.removeEventListener('resize', this.onWindowResize)

    this.volumeViewer.cleanup()
    if (this.labelViewer !== null && this.labelViewer !== undefined) {
      this.labelViewer.cleanup()
    }
    /*
     * FIXME: React appears to not clean the content of referenced
     * HTMLDivElement objects when the page is reloaded. As a consequence,
     * optical paths and other display items cannot be toggled or updated after
     * a manual page reload. I have tried using ref callbacks and passing the
     * ref objects from the parent component via the props. Both didn't work
     * either.
     */
  }

  onKeyDown = (event: KeyboardEvent): void => {
    this.keysDown.add(event.key)
  }

  onKeyUp = (event: KeyboardEvent): void => {
    this.keysDown.delete(event.key)
    if (event.key === 'Escape') {
      if (this.state.isRoiDrawingActive) {
        console.info('deactivate drawing of ROIs')
        this.volumeViewer.deactivateDrawInteraction()
        this.volumeViewer.activateSelectInteraction({})
      } else if (this.state.isRoiModificationActive) {
        console.info('deactivate modification of ROIs')
        this.volumeViewer.deactivateModifyInteraction()
        this.volumeViewer.activateSelectInteraction({})
      } else if (this.state.isRoiTranslationActive) {
        console.info('deactivate modification of ROIs')
        this.volumeViewer.deactivateTranslateInteraction()
        this.volumeViewer.activateSelectInteraction({})
      }
      this.setState({
        isAnnotationModalVisible: false,
        isSelectedRoiModalVisible: false,
        isRoiTranslationActive: false,
        isRoiDrawingActive: false,
        isRoiModificationActive: false,
        isGoToModalVisible: false
      })
    } else if (event.altKey) {
      if (event.code === 'KeyD') {
        this.handleRoiDrawing()
      } else if (event.code === 'KeyM') {
        this.handleRoiModification()
      } else if (event.code === 'KeyT') {
        this.handleRoiTranslation()
      } else if (event.code === 'KeyR') {
        this.handleRoiRemoval()
      } else if (event.code === 'KeyV') {
        this.handleRoiVisibilityChange()
      } else if (event.code === 'KeyS') {
        this.handleReportGeneration()
      } else if (event.code === 'KeyG') {
        this.handleGoTo()
      }
    }
  }

  componentWillUnmount = (): void => {
    this.volumeViewer.cleanup()
    if (this.labelViewer !== null && this.labelViewer !== undefined) {
      this.labelViewer.cleanup()
    }
    window.removeEventListener('beforeunload', this.componentCleanup)
  }

  componentSetup = (): void => {
    document.body.addEventListener(
      'dicommicroscopyviewer_roi_drawn',
      this.onRoiDrawn
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_roi_selected',
      this.onRoiSelected
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_viewport_clicked',
      this.onMapClicked
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_roi_double_clicked',
      this.onRoiDoubleClicked
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_pointer_move',
      this.onPointerMove
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_roi_removed',
      this.onRoiRemoved
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_roi_modified',
      this.onRoiModified
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_loading_started',
      this.onLoadingStarted
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_loading_ended',
      this.onLoadingEnded
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_loading_error',
      this.onLoadingError
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_frame_loading_started',
      this.onFrameLoadingStarted
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_frame_loading_ended',
      this.onFrameLoadingEnded
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_frame_loading_error',
      this.onFrameLoadingError
    )
    document.body.addEventListener(
      'keyup',
      this.onKeyUp
    )
    document.body.addEventListener(
      'keydown',
      this.onKeyDown
    )
    window.addEventListener('beforeunload', this.componentCleanup)
    window.addEventListener('resize', this.onWindowResize)
  }

  componentDidMount = (): void => {
    this.componentSetup()
    this.populateViewports()

    if (!this.props.slide.areVolumeImagesMonochrome) {
      let hasICCProfile = false
      const image = this.props.slide.volumeImages[0]
      const metadataItem = image.OpticalPathSequence[0]
      if (metadataItem.ICCProfile === null || metadataItem.ICCProfile === undefined) {
        if ('OpticalPathSequence' in image.bulkdataReferences) {
          // @ts-expect-error
          const bulkdataItem = image.bulkdataReferences.OpticalPathSequence[0]
          if ('ICCProfile' in bulkdataItem) {
            hasICCProfile = true
          }
        }
      } else {
        hasICCProfile = true
      }
      if (!hasICCProfile) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.warning('No ICC Profile was found for color images')
      }
    }
  }

  /**
   * Handler that gets called when a finding has been selected for annotation.
   *
   * @param value - Code value of the coded finding that got selected
   * @param option - Option that got selected
   */
  handleAnnotationFindingSelection = (
    value: string,
    _option: { label: React.ReactNode }
  ): void => {
    this.findingOptions.forEach(finding => {
      if (finding.CodeValue === value) {
        console.info(`selected finding "${finding.CodeMeaning}"`)
        this.setState({
          selectedFinding: finding,
          selectedEvaluations: []
        })
      }
    })
  }

  /**
   * Handler that gets called when a geometry type has been selected for
   * annotation.
   *
   * @param value - Code value of the coded finding that got selected
   * @param option - Option that got selected
   */
  handleAnnotationGeometryTypeSelection = (value: string, _option: { label: string }): void => {
    this.setState({ selectedGeometryType: value })
  }

  /**
   * Handler that gets called when measurements have been selected for
   * annotation.
   */
  handleAnnotationMeasurementActivation = (event: CheckboxChangeEvent): void => {
    const active: boolean = event.target.checked
    if (active) {
      this.setState({ selectedMarkup: 'measurement' })
    } else {
      this.setState({ selectedMarkup: undefined })
    }
  }

  /**
   * Handler that gets called when an evaluation has been selected for an
   * annotation.
   *
   * @param value - Code value of the coded evaluation that got selected
   * @param option - Option that got selected
   */
  handleAnnotationEvaluationSelection = (
    value: string,
    option: { label: dcmjs.sr.coding.CodedConcept }
  ): void => {
    const selectedFinding = this.state.selectedFinding
    if (selectedFinding !== undefined) {
      const key = buildKey(selectedFinding)
      const name = option.label
      this.evaluationOptions[key].forEach(evaluation => {
        if (
          evaluation.name.CodeValue === name.CodeValue &&
          evaluation.name.CodingSchemeDesignator === name.CodingSchemeDesignator
        ) {
          evaluation.values.forEach(code => {
            if (code.CodeValue === value) {
              const filteredEvaluations = this.state.selectedEvaluations.filter(
                (item: Evaluation) => item.name !== evaluation.name
              )
              this.setState({
                selectedEvaluations: [
                  ...filteredEvaluations,
                  { name: name, value: code }
                ]
              })
            }
          })
        }
      })
    }
  }

  /**
   * Handler that gets called when an evaluation has been cleared for an
   * annotation.
   */
  handleAnnotationEvaluationClearance = (): void => {
    this.setState({
      selectedEvaluations: []
    })
  }

  handleXCoordinateSelection = (value: number | string | null): void => {
    if (value !== null && value !== undefined) {
      const x = Number(value)
      this.setState(state => {
        const isValid = x >= state.validXCoordinateRange[0] && x <= state.validXCoordinateRange[1]
        return {
          selectedXCoordinate: x,
          isSelectedXCoordinateValid: isValid
        }
      })
    } else {
      this.setState({
        selectedXCoordinate: undefined,
        isSelectedXCoordinateValid: false
      })
    }
  }

  handleYCoordinateSelection = (value: number | string | null): void => {
    if (value !== null && value !== undefined) {
      const y = Number(value)
      this.setState(state => {
        const isValid = y >= state.validYCoordinateRange[0] && y <= state.validYCoordinateRange[1]
        return {
          selectedYCoordinate: y,
          isSelectedYCoordinateValid: isValid
        }
      })
    } else {
      this.setState({
        selectedYCoordinate: undefined,
        isSelectedYCoordinateValid: false
      })
    }
  }

  handleMagnificationSelection = (value: number | string | null): void => {
    if (value !== null && value !== undefined) {
      const magnification = Number(value)
      this.setState(() => {
        const isValid = magnification >= 0 && magnification <= 40
        return {
          selectedMagnification: magnification,
          isSelectedMagnificationValid: isValid
        }
      })
    } else {
      this.setState({
        selectedMagnification: undefined,
        isSelectedMagnificationValid: false
      })
    }
  }

  /**
   * Handler that gets called when the selection of slide position was
   * completed.
   */
  handleSlidePositionSelection = (): void => {
    if (
      this.state.isSelectedXCoordinateValid &&
      this.state.isSelectedYCoordinateValid &&
      this.state.isSelectedMagnificationValid &&
              this.state.selectedXCoordinate !== null && this.state.selectedXCoordinate !== undefined &&
        this.state.selectedYCoordinate !== null && this.state.selectedYCoordinate !== undefined &&
        this.state.selectedMagnification !== null && this.state.selectedMagnification !== undefined
    ) {
      console.info(
        'select slide position ' +
        `(${this.state.selectedXCoordinate}, ` +
        `${this.state.selectedYCoordinate}) ` +
        `at ${this.state.selectedMagnification}x magnification`
      )

      const factor = this.state.selectedMagnification
      /**
       * On an optical microscope an objective with 1x magnification
       * corresponds to approximately 10 micrometer pixel spacing
       * (due to the ocular).
       */
      const targetPixelSpacing = 0.01 / factor
      const diffs = []
      for (let i = 0; i < this.volumeViewer.numLevels; i++) {
        const actualPixelSpacing = this.volumeViewer.getPixelSpacing(i)[0]
        diffs.push(Math.abs(targetPixelSpacing - actualPixelSpacing))
      }
      const level = diffs.indexOf(Math.min(...diffs))
      this.volumeViewer.navigate({
        position: [
          this.state.selectedXCoordinate,
          this.state.selectedYCoordinate
        ],
        level: level
      })
      const point = new dmv.scoord3d.Point({
        coordinates: [
          this.state.selectedXCoordinate,
          this.state.selectedYCoordinate,
          0
        ],
        frameOfReferenceUID: this.volumeViewer.frameOfReferenceUID
      })
      const roi = new dmv.roi.ROI({ scoord3d: point })
      this.volumeViewer.addROI(roi, this.defaultRoiStyle)
      this.setState(state => {
        const visibleRoiUIDs = state.visibleRoiUIDs
        visibleRoiUIDs.add(roi.uid)
        return {
          visibleRoiUIDs,
          isGoToModalVisible: false
        }
      })
    }
  }

  /**
   * Handler that gets called when the selection of a slide position was
   * canceled.
   */
  handleSlidePositionSelectionCancellation = (): void => {
    console.info('cancel slide position selection')
    this.setState({
      isGoToModalVisible: false,
      selectedXCoordinate: undefined,
      selectedYCoordinate: undefined,
      selectedMagnification: undefined
    })
  }

  /**
   * Handler that gets called when annotation configuration has been completed.
   */
  handleAnnotationConfigurationCompletion = (): void => {
    console.debug('complete annotation configuration')
    const finding = this.state.selectedFinding
    const geometryType = this.state.selectedGeometryType
    const markup = this.state.selectedMarkup
    if (geometryType !== undefined && finding !== undefined) {
      this.volumeViewer.activateDrawInteraction({ geometryType, markup })
      this.setState({
        isAnnotationModalVisible: false,
        isRoiDrawingActive: true
      })
    } else {
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.VISUALIZATION,
          'Could not complete annotation configuration'
        )
      )
    }
  }

  /**
   * Handler that gets called when annotation configuration has been cancelled.
   */
  handleAnnotationConfigurationCancellation = (): void => {
    console.info('cancel annotation configuration')
    this.volumeViewer.activateSelectInteraction({})
    this.setState({
      isAnnotationModalVisible: false,
      isRoiDrawingActive: false
    })
  }

  /**
   * Handler that gets called when a report should be generated for the current
   * set of annotations.
   */
  handleReportGeneration = (): void => {
    console.info('save ROIs')
    const rois = this.volumeViewer.getAllROIs()
    const opticalPaths = this.volumeViewer.getAllOpticalPaths()
    const metadata = this.volumeViewer.getOpticalPathMetadata(
      opticalPaths[0].identifier
    )
    this.setState((prevState) => {
      const report = generateReport({
        rois,
        metadata,
        user: this.props.user,
        app: this.props.app,
        visibleRoiUIDs: prevState.visibleRoiUIDs
      })
      return {
        isReportModalVisible: report.isReportModalVisible,
        generatedReport: report.generatedReport
      }
    })
  }

  /**
   * Handler that gets called when a report should be verified. The current
   * list of annotations will be presented to the user together with other
   * pertinent metadata about the patient, study, and specimen.
   */
  handleReportVerification = (): void => {
    console.info('verify report generation')
    if (this.state.generatedReport !== undefined) {
      const client = this.props.clients[StorageClasses.COMPREHENSIVE_3D_SR]
      // The Comprehensive3DSR object should have a write method or similar
      // For now, let's try to access it as an ArrayBuffer directly
      client.storeInstances({ datasets: [(this.state.generatedReport as unknown as dcmjs.data.DicomDict).write()] }).then(
        () => message.info('Annotations were saved.')
      ).catch((error) => {
        console.error(error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.ENCODINGANDDECODING,
            'Annotations could not be saved'
          )
        )
      })
    }
    this.setState({
      isReportModalVisible: false,
      generatedReport: undefined
    })
  }

  /**
   * Handler that gets called when report generation has been cancelled.
   */
  handleReportCancellation = (): void => {
    this.setState({
      isReportModalVisible: false,
      generatedReport: undefined
    })
  }

  /**
   * Handle toggling of annotation visibility, i.e., whether a given
   * annotation should be either displayed or hidden by the viewer.
   */
  handleAnnotationVisibilityChange = ({ roiUID, isVisible }: {
    roiUID: string
    isVisible: boolean
  }): void => {
    if (isVisible) {
      console.info(`show ROI ${roiUID}`)
      const roi = this.volumeViewer.getROI(roiUID)
      const key = getRoiKey(roi)
      const style = this.getRoiStyle(key)
      this.volumeViewer.setROIStyle(roi.uid, style)
      this.setState(state => {
        const visibleRoiUIDs = state.visibleRoiUIDs
        visibleRoiUIDs.add(roi.uid)
        return { visibleRoiUIDs }
      })
    } else {
      console.info(`hide ROI ${roiUID}`)
      this.setState(state => {
        const selectedRoiUIDs = state.selectedRoiUIDs
        selectedRoiUIDs.delete(roiUID)
        const visibleRoiUIDs = state.visibleRoiUIDs
        visibleRoiUIDs.delete(roiUID)
        return { visibleRoiUIDs, selectedRoiUIDs }
      })
      this.volumeViewer.setROIStyle(roiUID, {})
    }
  }

  /**
   * Handle toggling of annotation group visibility, i.e., whether a given
   * annotation group should be either displayed or hidden by the viewer.
   */
  handleAnnotationGroupVisibilityChange = ({ annotationGroupUID, isVisible }: {
    annotationGroupUID: string
    isVisible: boolean
  }): void => {
    const allAnnotationGroups = this.volumeViewer.getAllAnnotationGroups()
    const annotationGroup = allAnnotationGroups.find(ag => ag.uid === annotationGroupUID)
    if (annotationGroup !== null && annotationGroup !== undefined) {
      runValidations({
        dialog: true,
        context: { annotationGroup, slide: this.props.slide }
      })
    }

    console.log(`change visibility of annotation group ${annotationGroupUID}`)
    if (isVisible) {
      console.info(`show annotation group ${annotationGroupUID}`)
      try {
        this.volumeViewer.showAnnotationGroup(annotationGroupUID)
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Failed to show annotation group.'
          )
        )
        throw error
      }
      this.setState(state => {
        const visibleAnnotationGroupUIDs = new Set(
          state.visibleAnnotationGroupUIDs
        )
        visibleAnnotationGroupUIDs.add(annotationGroupUID)
        return { visibleAnnotationGroupUIDs }
      })
    } else {
      console.info(`hide annotation group ${annotationGroupUID}`)
      this.volumeViewer.hideAnnotationGroup(annotationGroupUID)
      this.setState(state => {
        const visibleAnnotationGroupUIDs = new Set(
          state.visibleAnnotationGroupUIDs
        )
        visibleAnnotationGroupUIDs.delete(annotationGroupUID)
        return { visibleAnnotationGroupUIDs }
      })
    }
  }

  /**
   * Handle change of annotation group style.
   */
  handleAnnotationGroupStyleChange = ({ uid, styleOptions }: {
    uid: string
    styleOptions: {
      opacity?: number
      color?: number[]
      measurement?: dcmjs.sr.coding.CodedConcept
    }
  }): void => {
    console.log(`change style of annotation group ${uid}`)
    try {
      this.volumeViewer.setAnnotationGroupStyle(
        uid,
        styleOptions
      )
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.VISUALIZATION,
          'Failed to change style of annotation group.'
        )
      )
      throw error
    }
  }

  generateRoiStyle = (
    styleOptions: StyleOptions): dmv.viewer.ROIStyleOptions => {
    const opacity = styleOptions.opacity ?? DEFAULT_ANNOTATION_OPACITY
    const strokeColor = styleOptions.color ?? DEFAULT_ANNOTATION_STROKE_COLOR
    const fillColor = styleOptions.contourOnly ? [0, 0, 0, 0] : strokeColor.map((c) => Math.min(c + 25, 255))
    const style = formatRoiStyle({
      fill: { color: [...fillColor, opacity] },
      stroke: { color: [...strokeColor, opacity] },
      radius: this.defaultRoiStyle.stroke?.width
    })
    return style
  }

  handleRoiStyleChange = ({ uid, styleOptions }: {
    uid: string
    styleOptions: StyleOptions
  }): void => {
    console.log(`change style of ROI ${uid}`)
    try {
      this.defaultAnnotationStyles[uid] = styleOptions
      const style = this.generateRoiStyle(styleOptions)

      const roi = this.volumeViewer.getROI(uid)
      const key = getRoiKey(roi) as string
      this.roiStyles[key] = style
      this.volumeViewer.setROIStyle(uid, style)
      this.state.visibleRoiUIDs.add(uid)
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      NotificationMiddleware.onError(
        NotificationMiddlewareContext.SLIM,
        new CustomError(
          errorTypes.VISUALIZATION,
          'Failed to change style of ROI.'
        )
      )
      throw error
    }
  }

  /**
   * Handle toggling of segment visibility, i.e., whether a given
   * segment should be either displayed or hidden by the viewer.
   */
  handleSegmentVisibilityChange = ({ segmentUID, isVisible }: {
    segmentUID: string
    isVisible: boolean
  }): void => {
    console.log(`change visibility of segment ${segmentUID}`)
    if (isVisible) {
      console.info(`show segment ${segmentUID}`)
      this.volumeViewer.showSegment(segmentUID)
      this.setState(state => {
        const visibleSegmentUIDs = new Set(state.visibleSegmentUIDs)
        visibleSegmentUIDs.add(segmentUID)
        return { visibleSegmentUIDs }
      })
    } else {
      console.info(`hide segment ${segmentUID}`)
      this.volumeViewer.hideSegment(segmentUID)
      this.setState(state => {
        const visibleSegmentUIDs = new Set(state.visibleSegmentUIDs)
        visibleSegmentUIDs.delete(segmentUID)
        return { visibleSegmentUIDs }
      })
    }
  }

  /**
   * Handle change of segment style.
   */
  handleSegmentStyleChange = ({ segmentUID, styleOptions }: {
    segmentUID: string
    styleOptions: {
      opacity?: number
    }
  }): void => {
    console.log(`change style of segment ${segmentUID}`)
    this.volumeViewer.setSegmentStyle(segmentUID, styleOptions)
  }

  /**
   * Handle toggling of mapping visibility, i.e., whether a given
   * mapping should be either displayed or hidden by the viewer.
   */
  handleMappingVisibilityChange = ({ mappingUID, isVisible }: {
    mappingUID: string
    isVisible: boolean
  }): void => {
    console.log(`change visibility of mapping ${mappingUID}`)
    if (isVisible) {
      console.info(`show mapping ${mappingUID}`)
      this.volumeViewer.showParameterMapping(mappingUID)
      this.setState(state => {
        const visibleMappingUIDs = new Set(state.visibleMappingUIDs)
        visibleMappingUIDs.add(mappingUID)
        return { visibleMappingUIDs }
      })
    } else {
      console.info(`hide mapping ${mappingUID}`)
      this.volumeViewer.hideParameterMapping(mappingUID)
      this.setState(state => {
        const visibleMappingUIDs = new Set(state.visibleMappingUIDs)
        visibleMappingUIDs.delete(mappingUID)
        return { visibleMappingUIDs }
      })
    }
  }

  /**
   * Handle change of mapping style.
   */
  handleMappingStyleChange = ({ mappingUID, styleOptions }: {
    mappingUID: string
    styleOptions: {
      opacity?: number
    }
  }): void => {
    console.log(`change style of mapping ${mappingUID}`)
    this.volumeViewer.setParameterMappingStyle(mappingUID, styleOptions)
  }

  /**
   * Handle toggling of optical path visibility, i.e., whether a given
   * optical path should be either displayed or hidden by the viewer.
   */
  handleOpticalPathVisibilityChange = ({ opticalPathIdentifier, isVisible }: {
    opticalPathIdentifier: string
    isVisible: boolean
  }): void => {
    console.log(`change visibility of optical path ${opticalPathIdentifier}`)
    if (isVisible) {
      console.info(`show optical path ${opticalPathIdentifier}`)
      this.volumeViewer.showOpticalPath(opticalPathIdentifier)
      this.setState(state => {
        const visibleOpticalPathIdentifiers = new Set(
          state.visibleOpticalPathIdentifiers
        )
        visibleOpticalPathIdentifiers.add(opticalPathIdentifier)
        return { visibleOpticalPathIdentifiers }
      })
    } else {
      console.info(`hide optical path ${opticalPathIdentifier}`)
      this.volumeViewer.hideOpticalPath(opticalPathIdentifier)
      this.setState(state => {
        const visibleOpticalPathIdentifiers = new Set(
          state.visibleOpticalPathIdentifiers
        )
        visibleOpticalPathIdentifiers.delete(opticalPathIdentifier)
        return { visibleOpticalPathIdentifiers }
      })
    }
  }

  /**
   * Handle change of optical path style.
   */
  handleOpticalPathStyleChange = ({ opticalPathIdentifier, styleOptions }: {
    opticalPathIdentifier: string
    styleOptions: {
      opacity?: number
      color?: number[]
      limitValues?: number[]
    }
  }): void => {
    console.log(`change style of optical path ${opticalPathIdentifier}`)
    this.volumeViewer.setOpticalPathStyle(opticalPathIdentifier, styleOptions)
  }

  /**
   * Handle toggling of optical path activity, i.e., whether a given
   * optical path should be either added or removed from the viewport.
   */
  handleOpticalPathActivityChange = ({ opticalPathIdentifier, isActive }: {
    opticalPathIdentifier: string
    isActive: boolean
  }): void => {
    console.log(`change activity of optical path ${opticalPathIdentifier}`)
    if (isActive) {
      console.info(`activate optical path ${opticalPathIdentifier}`)
      this.volumeViewer.activateOpticalPath(opticalPathIdentifier)
      this.setState(state => {
        const activeOpticalPathIdentifiers = new Set(
          state.activeOpticalPathIdentifiers
        )
        activeOpticalPathIdentifiers.add(opticalPathIdentifier)
        return { activeOpticalPathIdentifiers }
      })
    } else {
      console.info(`deactivate optical path ${opticalPathIdentifier}`)
      this.volumeViewer.deactivateOpticalPath(opticalPathIdentifier)
      this.setState(state => {
        const activeOpticalPathIdentifiers = new Set(
          state.activeOpticalPathIdentifiers
        )
        activeOpticalPathIdentifiers.delete(opticalPathIdentifier)
        return { activeOpticalPathIdentifiers }
      })
    }
  }

  /**
   * Set default presentation state that is either defined by metadata included
   * in the DICOM Slide Microscopy instance or by the viewer.
   */
  setDefaultPresentationState = (): void => {
    const visibleOpticalPathIdentifiers: Set<string> = new Set()
    const opticalPaths = this.volumeViewer.getAllOpticalPaths()
    opticalPaths.sort((a, b) => {
      if (a.identifier.localeCompare(b.identifier) === 1) {
        return 1
      } else if (b.identifier.localeCompare(a.identifier) === 1) {
        return -1
      }
      return 0
    })
    opticalPaths.forEach((item: dmv.opticalPath.OpticalPath) => {
      const identifier = item.identifier
      const style = this.volumeViewer.getOpticalPathDefaultStyle(identifier)
      this.volumeViewer.setOpticalPathStyle(identifier, style)
      this.volumeViewer.hideOpticalPath(identifier)
      this.volumeViewer.deactivateOpticalPath(identifier)
      if (item.isMonochromatic) {
        /*
         * If the image metadata contains a palette color lookup table for the
         * optical path, then it will be displayed by default.
         */
        if (item.paletteColorLookupTableUID !== null) {
          visibleOpticalPathIdentifiers.add(identifier)
        }
      } else {
        /* Color images will always be displayed by default. */
        visibleOpticalPathIdentifiers.add(identifier)
      }
    })

    /*
     * If no optical paths have been selected for visualization so far, select
     * first n optical paths and set a default value of interest (VOI) window
     * (using pre-computed pixel data statistics) and a default color.
     */
    if (visibleOpticalPathIdentifiers.size === 0) {
      const defaultColors = [
        [255, 255, 255]
      ]
      opticalPaths.forEach((item: dmv.opticalPath.OpticalPath) => {
        const identifier = item.identifier
        if (item.isMonochromatic) {
          const numVisible = visibleOpticalPathIdentifiers.size
          if (numVisible < defaultColors.length) {
            const style = {
              ...this.volumeViewer.getOpticalPathStyle(identifier)
            }
            const index = numVisible
            style.color = defaultColors[index]
            const stats = this.state.pixelDataStatistics[item.identifier]
            if (stats !== null) {
              style.limitValues = [stats.min, stats.max]
            }
            this.volumeViewer.setOpticalPathStyle(item.identifier, style)
            visibleOpticalPathIdentifiers.add(item.identifier)
          }
        }
      })
    }

    console.info(
      `selected n=${visibleOpticalPathIdentifiers.size} optical paths ` +
      'for visualization'
    )
    visibleOpticalPathIdentifiers.forEach(identifier => {
      this.volumeViewer.showOpticalPath(identifier)
    })
    this.setState(state => ({
      activeOpticalPathIdentifiers: new Set(visibleOpticalPathIdentifiers),
      visibleOpticalPathIdentifiers: new Set(visibleOpticalPathIdentifiers)
    }))
  }

  /**
   * Handler that gets called when a presentation state has been selected from
   * the current list of available presentation states.
   */
  handlePresentationStateReset = (): void => {
    this.setState({ selectedPresentationStateUID: undefined })
    const urlPath = this.props.location.pathname
    this.props.navigate(urlPath)
    this.setDefaultPresentationState()
  }

  /**
   * Handler that gets called when a presentation state has been selected from
   * the current list of available presentation states.
   */
  handlePresentationStateSelection = (
    value?: string,
    _option?: unknown
  ): void => {
    if (value !== null) {
      console.info(`select Presentation State instance "${value ?? 'undefined'}"`)
      let presentationState
      this.state.presentationStates.forEach(instance => {
        if (instance.SOPInstanceUID === value) {
          presentationState = instance
        }
      })
      if (presentationState !== null && presentationState !== undefined) {
        let urlPath = this.props.location.pathname
        urlPath += `?state=${value ?? ''}`
        this.props.navigate(urlPath)
        this.setPresentationState(presentationState)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.SLIM,
          new CustomError(
            errorTypes.VISUALIZATION,
            'Presentation State could not be found'
          )
        )
        console.log(
          'failed to handle section of presentation state: ' +
          `could not find instance "${value ?? 'undefined'}"`
        )
      }
    } else {
      this.handlePresentationStateReset()
    }
    this.setState({ selectedPresentationStateUID: value })
  }

  /**
   * Handler that will toggle the ROI drawing tool, i.e., either activate or
   * de-activate it, depending on its current state.
   */
  handleRoiDrawing = (): void => {
    if (this.state.isRoiDrawingActive) {
      console.info('deactivate drawing of ROIs')
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.activateSelectInteraction({})
      this.setState({
        isAnnotationModalVisible: false,
        isSelectedRoiModalVisible: false,
        isRoiTranslationActive: false,
        isRoiDrawingActive: false,
        isRoiModificationActive: false,
        isGoToModalVisible: false
      })
    } else {
      console.info('activate drawing of ROIs')
      this.setState({
        isAnnotationModalVisible: true,
        isSelectedRoiModalVisible: false,
        isRoiDrawingActive: true,
        isRoiModificationActive: false,
        isRoiTranslationActive: false,
        isGoToModalVisible: false
      })
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.deactivateSnapInteraction()
      this.volumeViewer.deactivateTranslateInteraction()
      this.volumeViewer.deactivateModifyInteraction()
    }
  }

  /**
   * Handler that will toggle the ROI modification tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiModification = (): void => {
    console.info('toggle modification of ROIs')
    if (this.volumeViewer.isModifyInteractionActive) {
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.deactivateSnapInteraction()
      this.volumeViewer.activateSelectInteraction({})
      this.setState({
        isRoiTranslationActive: false,
        isRoiDrawingActive: false,
        isRoiModificationActive: false
      })
    } else {
      this.setState({
        isRoiModificationActive: true,
        isRoiDrawingActive: false,
        isRoiTranslationActive: false
      })
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.deactivateTranslateInteraction()
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.activateSnapInteraction({})
      this.volumeViewer.activateModifyInteraction({})
    }
  }

  /**
   * Handler that will toggle the ROI translation tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiTranslation = (): void => {
    console.info('toggle translation of ROIs')
    if (this.volumeViewer.isTranslateInteractionActive) {
      this.volumeViewer.deactivateTranslateInteraction()
      this.setState({
        isRoiTranslationActive: false,
        isRoiDrawingActive: false,
        isRoiModificationActive: false
      })
    } else {
      this.setState({
        isRoiTranslationActive: true,
        isRoiDrawingActive: false,
        isRoiModificationActive: false
      })
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.deactivateSnapInteraction()
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.activateTranslateInteraction({})
    }
  }

  handleGoTo = (): void => {
    this.volumeViewer.deactivateDrawInteraction()
    this.volumeViewer.deactivateModifyInteraction()
    this.volumeViewer.deactivateSnapInteraction()
    this.volumeViewer.deactivateTranslateInteraction()
    this.volumeViewer.deactivateSelectInteraction()
    this.setState({
      isGoToModalVisible: true,
      isAnnotationModalVisible: false,
      isSelectedRoiModalVisible: false,
      isReportModalVisible: false,
      isRoiTranslationActive: false,
      isRoiModificationActive: false,
      isRoiDrawingActive: false
    })
  }

  /**
   * Handler that will toggle the ROI removal tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiRemoval = (): void => {
    this.volumeViewer.deactivateDrawInteraction()
    this.volumeViewer.deactivateSnapInteraction()
    this.volumeViewer.deactivateTranslateInteraction()
    this.volumeViewer.deactivateModifyInteraction()
    if (this.state.selectedRoiUIDs.size > 0) {
      this.state.selectedRoiUIDs.forEach(uid => {
        if (uid === undefined) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          message.warning('No annotation was selected for removal')
          return
        }
        console.info(`remove ROI "${uid}"`)
        this.volumeViewer.removeROI(uid)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.info('Annotation was removed')
      })
      this.setState({
        selectedRoiUIDs: new Set(),
        isRoiTranslationActive: false,
        isRoiDrawingActive: false,
        isRoiModificationActive: false
      })
    } else {
      this.state.visibleRoiUIDs.forEach(uid => {
        console.info(`remove ROI "${uid}"`)
        this.volumeViewer.removeROI(uid)
      })
      this.setState({
        visibleRoiUIDs: new Set(),
        isRoiTranslationActive: false,
        isRoiDrawingActive: false,
        isRoiModificationActive: false
      })
    }
    this.volumeViewer.activateSelectInteraction({})
  }

  /**
   * Handler that will toggle the ROI visibility tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiVisibilityChange = (): void => {
    console.info('toggle visibility of ROIs')
    if (!this.state.areRoisHidden) {
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.deactivateSnapInteraction()
      this.volumeViewer.deactivateTranslateInteraction()
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.hideROIs()
      this.setState({
        areRoisHidden: true,
        isRoiDrawingActive: false,
        isRoiModificationActive: false,
        isRoiTranslationActive: false
      })
    } else {
      this.volumeViewer.showROIs()
      this.volumeViewer.activateSelectInteraction({})
      this.state.selectedRoiUIDs.forEach(uid => {
        if (uid !== undefined) {
          this.volumeViewer.setROIStyle(uid, this.selectedRoiStyle)
        }
      })
      this.setState({ areRoisHidden: false })
    }
  }

  handleAnnotationGroupClick = (annotationGroupUID: string): void => {
    this.volumeViewer.zoomToROI(annotationGroupUID)
  }

  handleAnnotationGroupSelection = (value: string): void => {
    // Hide all currently visible annotation groups when selection changes
    this.state.visibleAnnotationGroupUIDs.forEach(annotationGroupUID => {
      this.volumeViewer.hideAnnotationGroup(annotationGroupUID)
    })

    // Reset the visible annotation groups state
    this.setState({
      selectedSeriesInstanceUID: value,
      visibleAnnotationGroupUIDs: new Set()
    })
  }

  getSeriesDescription = (seriesInstanceUID: string): string => {
    // Get the study from DicomMetadataStore
    const study = DicomMetadataStore.getStudy(this.props.studyInstanceUID)

    if ((study?.series) !== null && study !== null && study !== undefined) {
      // Find the series that matches this series instance UID
      const series = study.series.find(s => s.SeriesInstanceUID === seriesInstanceUID)

      if (series?.SeriesDescription !== undefined && series.SeriesDescription !== '') {
        return series.SeriesDescription
      }
    }

    // Fallback to truncated UID if no description found
    return `Series ${seriesInstanceUID.slice(0, 8)}...`
  }

  /**
   * Handler that will toggle the ICC profile color management, i.e., either
   * enable or disable it, depending on its current state.
   */
  handleICCProfilesToggle = (event: CheckboxChangeEvent): void => {
    const checked = event.target.checked
    this.setState({ isICCProfilesEnabled: checked })
    this.volumeViewer.toggleICCProfiles()
  }

  formatAnnotation = (annotation: AnnotationCategoryAndType): void => {
    const roi = this.volumeViewer.getROI(annotation.uid)
    const key = getRoiKey(roi) as string
    const color = this.roiStyles[key] !== undefined
      ? this.roiStyles[key].stroke?.color.slice(0, 3)
      : DEFAULT_ANNOTATION_COLOR_PALETTE[
        Object.keys(this.roiStyles).length % DEFAULT_ANNOTATION_COLOR_PALETTE.length
      ]
    this.defaultAnnotationStyles[annotation.uid] = {
      color: color as number[],
      opacity: DEFAULT_ANNOTATION_OPACITY,
      contourOnly: false
    }

    this.roiStyles[key] = this.generateRoiStyle(
      this.defaultAnnotationStyles[annotation.uid]
    )
  }

  // Helper functions to extract render logic
  private readonly getDataFromViewer = (): {
    rois: dmv.roi.ROI[]
    segments: dmv.segment.Segment[]
    mappings: dmv.mapping.ParameterMapping[]
    annotationGroups: dmv.annotation.AnnotationGroup[]
    annotations: AnnotationCategoryAndType[]
  } => {
    const rois: dmv.roi.ROI[] = []
    const segments: dmv.segment.Segment[] = []
    const mappings: dmv.mapping.ParameterMapping[] = []
    const annotationGroups: dmv.annotation.AnnotationGroup[] = []
    rois.push(...this.volumeViewer.getAllROIs())
    segments.push(...this.volumeViewer.getAllSegments())
    mappings.push(...this.volumeViewer.getAllParameterMappings())
    const allAnnotationGroups = this.volumeViewer.getAllAnnotationGroups()
    const filteredAnnotationGroups = allAnnotationGroups?.filter((annotationGroup) =>
      annotationGroup.referencedSeriesInstanceUID === this.props.seriesInstanceUID
    )
    annotationGroups.push(...filteredAnnotationGroups)

    const annotations = rois.map(roi => adaptRoiToAnnotation(roi))

    return { rois, segments, mappings, annotationGroups, annotations }
  }

  private static getOpenSubMenuItems (): string[] {
    return ['specimens', 'optical-paths', 'annotations', 'presentation-states']
  }

  private readonly getReport = (): React.ReactNode => {
    const dataset = this.state.generatedReport
    if (dataset !== undefined) {
      return <Report dataset={dataset} />
    }
    return undefined
  }

  private readonly getAnnotationMenuItems = (rois: dmv.roi.ROI[]): React.ReactNode => {
    if (rois.length > 0) {
      return (
        <AnnotationList
          rois={rois}
          selectedRoiUIDs={this.state.selectedRoiUIDs}
          visibleRoiUIDs={this.state.visibleRoiUIDs}
          onSelection={this.handleAnnotationSelection}
          onVisibilityChange={this.handleAnnotationVisibilityChange}
        />
      )
    }
    return undefined
  }

  private readonly getFindingOptions = (): React.ReactNode[] => {
    return this.findingOptions.map((finding, index) => {
      return (
        <Select.Option
          key={(finding.CodeValue !== undefined && finding.CodeValue !== '') ? finding.CodeValue : `finding-${index}`}
          value={finding.CodeValue}
        >
          {finding.CodeMeaning}
        </Select.Option>
      )
    })
  }

  private static getGeometryTypeOptionsMapping (): { [key: string]: React.ReactNode } {
    return {
      point: <Select.Option key='point' value='point'>Point</Select.Option>,
      circle: <Select.Option key='circle' value='circle'>Circle</Select.Option>,
      box: <Select.Option key='box' value='box'>Box</Select.Option>,
      polygon: <Select.Option key='polygon' value='polygon'>Polygon</Select.Option>,
      line: <Select.Option key='line' value='line'>Line</Select.Option>,
      freehandpolygon: (
        <Select.Option key='freehandpolygon' value='freehandpolygon'>
          Polygon (freehand)
        </Select.Option>
      ),
      freehandline: (
        <Select.Option key='freehandline' value='freehandline'>
          Line (freehand)
        </Select.Option>
      )
    }
  }

  private readonly getAnnotationConfigurations = (): React.ReactNode[] => {
    const findingOptions = this.getFindingOptions()
    const geometryTypeOptionsMapping = SlideViewer.getGeometryTypeOptionsMapping()

    const annotationConfigurations: React.ReactNode[] = [
      (
        <Select
          style={{ minWidth: 130 }}
          onSelect={this.handleAnnotationFindingSelection}
          key='annotation-finding'
          defaultActiveFirstOption
          placeholder='Select finding'
        >
          {findingOptions}
        </Select>
      )
    ]
    const selectedFinding = this.state.selectedFinding
    if (selectedFinding !== undefined) {
      const key = buildKey(selectedFinding)
      this.evaluationOptions[key].forEach((evaluation, index) => {
        const evaluationOptions = evaluation.values.map(code => {
          return (
            <Select.Option
              key={(code.CodeValue !== undefined && code.CodeValue !== '') ? code.CodeValue : `evaluation-${index}`}
              value={code.CodeValue}
              label={evaluation.name}
            >
              {code.CodeMeaning}
            </Select.Option>
          )
        })
        annotationConfigurations.push(
          <>
            {evaluation.name.CodeMeaning}
            <Select
              style={{ minWidth: 130 }}
              onSelect={this.handleAnnotationEvaluationSelection}
              allowClear
              onClear={this.handleAnnotationEvaluationClearance}
              defaultActiveFirstOption={false}
            >
              {evaluationOptions}
            </Select>
          </>
        )
      })
      const geometryTypeOptions = this.geometryTypeOptions[key].map(name => {
        return geometryTypeOptionsMapping[name]
      })
      annotationConfigurations.push(
        <>
          ROI geometry type
          <Select
            style={{ minWidth: 130 }}
            onSelect={this.handleAnnotationGeometryTypeSelection}
            key='annotation-geometry-type'
            placeholder='Select geometry type'
          >
            {geometryTypeOptions}
          </Select>
        </>
      )
      annotationConfigurations.push(
        <Checkbox
          onChange={this.handleAnnotationMeasurementActivation}
          key='annotation-measurement'
        >
          measure
        </Checkbox>
      )
    }

    return annotationConfigurations
  }

  private readonly getSpecimenMenu = (): React.ReactNode => {
    return (
      <Menu.SubMenu key='specimens' title='Specimens'>
        <SpecimenList
          metadata={this.props.slide.volumeImages[0]}
          showstain={false}
        />
      </Menu.SubMenu>
    )
  }

  private readonly getEquipmentMenu = (): React.ReactNode => {
    return (
      <Menu.SubMenu key='equipment' title='Equipment'>
        <Equipment metadata={this.props.slide.volumeImages[0]} />
      </Menu.SubMenu>
    )
  }

  private readonly getOpticalPathMenu = (): React.ReactNode => {
    const opticalPaths = this.volumeViewer.getAllOpticalPaths()
    opticalPaths.sort((a, b) => {
      if (a.identifier.localeCompare(b.identifier) === 1) {
        return 1
      } else if (b.identifier.localeCompare(a.identifier) === 1) {
        return -1
      }
      return 0
    })
    const opticalPathStyles: {
      [identifier: string]: {
        opacity: number
        color?: number[]
        limitValues?: number[]
        paletteColorLookupTable?: dmv.color.PaletteColorLookupTable
      }
    } = {}
    const opticalPathMetadata: {
      [identifier: string]: dmv.metadata.VLWholeSlideMicroscopyImage[]
    } = {}
    opticalPaths.forEach(opticalPath => {
      const identifier = opticalPath.identifier
      const metadata = this.volumeViewer.getOpticalPathMetadata(identifier)
      opticalPathMetadata[identifier] = metadata
      const style = {
        ...this.volumeViewer.getOpticalPathStyle(identifier)
      }
      opticalPathStyles[identifier] = style
    })
    return (
      <Menu.SubMenu key='optical-paths' title='Optical Paths'>
        <OpticalPathList
          metadata={opticalPathMetadata}
          opticalPaths={opticalPaths}
          defaultOpticalPathStyles={opticalPathStyles}
          visibleOpticalPathIdentifiers={this.state.visibleOpticalPathIdentifiers}
          activeOpticalPathIdentifiers={this.state.activeOpticalPathIdentifiers}
          onOpticalPathVisibilityChange={this.handleOpticalPathVisibilityChange}
          onOpticalPathStyleChange={this.handleOpticalPathStyleChange}
          onOpticalPathActivityChange={this.handleOpticalPathActivityChange}
          selectedPresentationStateUID={this.state.selectedPresentationStateUID}
        />
      </Menu.SubMenu>
    )
  }

  private readonly getPresentationStateMenu = (): React.ReactNode => {
    if (this.state.presentationStates.length > 0) {
      const presentationStateOptions = []
      this.state.presentationStates.forEach((instance, index) => {
        presentationStateOptions.push(
          <Select.Option
            key={(instance.SOPInstanceUID !== undefined && instance.SOPInstanceUID !== '') ? instance.SOPInstanceUID : `presentation-state-${index}`}
            value={instance.SOPInstanceUID}
            dropdownMatchSelectWidth={false}
            size='small'
          >
            {instance.ContentDescription !== undefined && instance.ContentDescription !== '' ? instance.ContentDescription : 'Untitled'}
          </Select.Option>
        )
      })
      presentationStateOptions.push(
        <Select.Option
          key='default-presentation-state'
          value={undefined}
          dropdownMatchSelectWidth={false}
          size='small'
        >
          {null}
        </Select.Option>
      )
      return (
        <Menu.SubMenu key='presentation-states' title='Presentation States'>
          <Space align='center' size={20} style={{ padding: '14px' }}>
            <Select
              style={{ minWidth: 200, maxWidth: 200 }}
              onSelect={this.handlePresentationStateSelection}
              key='presentation-states'
              value={this.state.selectedPresentationStateUID}
            >
              {presentationStateOptions}
            </Select>
            <Tooltip title='Reset'>
              <Btn
                icon={UndoOutlined}
                onClick={this.handlePresentationStateReset}
              />
            </Tooltip>
          </Space>
        </Menu.SubMenu>
      )
    }
    return undefined
  }

  private readonly getSegmentationMenu = (segments: dmv.segment.Segment[]): React.ReactNode => {
    if (segments.length > 0) {
      const defaultSegmentStyles: {
        [segmentUID: string]: {
          opacity: number
        }
      } = {}
      const segmentMetadata: {
        [segmentUID: string]: dmv.metadata.Segmentation[]
      } = {}
      segments.forEach(segment => {
        defaultSegmentStyles[segment.uid] = this.volumeViewer.getSegmentStyle(
          segment.uid
        )
        segmentMetadata[segment.uid] = this.volumeViewer.getSegmentMetadata(
          segment.uid
        )
      })
      return (
        <Menu.SubMenu key='segmentations' title='Segmentations'>
          <SegmentList
            segments={segments}
            metadata={segmentMetadata}
            defaultSegmentStyles={defaultSegmentStyles}
            visibleSegmentUIDs={this.state.visibleSegmentUIDs}
            onSegmentVisibilityChange={this.handleSegmentVisibilityChange}
            onSegmentStyleChange={this.handleSegmentStyleChange}
          />
        </Menu.SubMenu>
      )
    }
    return undefined
  }

  private readonly getParametricMapMenu = (mappings: dmv.mapping.ParameterMapping[]): React.ReactNode => {
    if (mappings.length > 0) {
      const defaultMappingStyles: {
        [mappingUID: string]: {
          opacity: number
        }
      } = {}
      const mappingMetadata: {
        [mappingUID: string]: dmv.metadata.ParametricMap[]
      } = {}
      mappings.forEach(mapping => {
        defaultMappingStyles[mapping.uid] = this.volumeViewer.getParameterMappingStyle(
          mapping.uid
        )
        mappingMetadata[mapping.uid] = this.volumeViewer.getParameterMappingMetadata(
          mapping.uid
        )
      })
      return (
        <Menu.SubMenu key='parmetric-maps' title='Parametric Maps'>
          <MappingList
            mappings={mappings}
            metadata={mappingMetadata}
            defaultMappingStyles={defaultMappingStyles}
            visibleMappingUIDs={this.state.visibleMappingUIDs}
            onMappingVisibilityChange={this.handleMappingVisibilityChange}
            onMappingStyleChange={this.handleMappingStyleChange}
          />
        </Menu.SubMenu>
      )
    }
    return undefined
  }

  private readonly getAnnotationGroupMenu = (annotationGroups: dmv.annotation.AnnotationGroup[]): React.ReactNode => {
    if (annotationGroups.length > 0) {
      const annotationGroupMetadata: {
        [annotationGroupUID: string]: dmv.metadata.MicroscopyBulkSimpleAnnotations
      } = {}
      const defaultAnnotationGroupStyles: {
        [annotationUID: string]: {
          opacity: number
          color: number[]
        }
      } = {}
      annotationGroups.forEach(annotationGroup => {
        defaultAnnotationGroupStyles[annotationGroup.uid] = this.volumeViewer.getAnnotationGroupStyle(
          annotationGroup.uid
        )
        annotationGroupMetadata[annotationGroup.uid] = this.volumeViewer.getAnnotationGroupMetadata(
          annotationGroup.uid
        )
      })

      // Group annotation groups by seriesInstanceUID
      const annotationGroupsBySeries: { [seriesInstanceUID: string]: dmv.annotation.AnnotationGroup[] } = {}
      annotationGroups.forEach(annotationGroup => {
        const seriesUID = annotationGroup.seriesInstanceUID
        if (!(seriesUID in annotationGroupsBySeries)) {
          annotationGroupsBySeries[seriesUID] = []
        }
        annotationGroupsBySeries[seriesUID].push(annotationGroup)
      })

      // Initialize selected series if not set
      if (this.state.selectedSeriesInstanceUID === undefined && annotationGroups.length !== 0) {
        this.setState({ selectedSeriesInstanceUID: 'all' })
      }

      // Create dropdown options for series
      const dropdownOptions = [
        {
          value: 'all',
          label: 'All'
        },
        ...Object.keys(annotationGroupsBySeries).map((seriesUID) => ({
          value: seriesUID,
          label: `${this.getSeriesDescription(seriesUID)} (${annotationGroupsBySeries[seriesUID]?.length ?? 0} groups)`
        }))
      ]

      // Get annotation groups for the selected series or all series
      const selectedSeriesAnnotationGroups = this.state.selectedSeriesInstanceUID === 'all'
        ? annotationGroups
        : (this.state.selectedSeriesInstanceUID !== undefined
            ? annotationGroupsBySeries[this.state.selectedSeriesInstanceUID] ?? []
            : [])

      return (
        <Menu.SubMenu key='annotation-groups' title='Annotation Groups'>
          {/* Series Selection Dropdown */}
          <div
            style={{
              paddingLeft: '14px',
              paddingRight: '14px',
              paddingTop: '7px',
              paddingBottom: '7px'
            }}
          >
            <Select
              style={{ width: '100%' }}
              placeholder='Select a series'
              value={this.state.selectedSeriesInstanceUID}
              onChange={this.handleAnnotationGroupSelection}
              options={dropdownOptions}
            />
          </div>

          {/* Display annotation groups for the selected series */}
          {selectedSeriesAnnotationGroups.length > 0 && (
            <AnnotationGroupList
              annotationGroups={selectedSeriesAnnotationGroups}
              metadata={annotationGroupMetadata}
              onAnnotationGroupClick={this.handleAnnotationGroupClick}
              // when adding annotationGroups to annotationCategory list,
              // make so that this is uses this.defaultAnnotationStyles later instead of defaultAnnotationGroupStyles
              defaultAnnotationGroupStyles={defaultAnnotationGroupStyles}
              visibleAnnotationGroupUIDs={this.state.visibleAnnotationGroupUIDs}
              onAnnotationGroupVisibilityChange={this.handleAnnotationGroupVisibilityChange}
              onAnnotationGroupStyleChange={this.handleAnnotationGroupStyleChange}
            />
          )}
        </Menu.SubMenu>
      )
    }
    return undefined
  }

  private readonly getToolbar = (): { toolbar: React.ReactNode, toolbarHeight: string } => {
    const annotationTools = [
      <Btn
        tooltip='Draw ROI [Alt+D]'
        icon={FaDrawPolygon}
        onClick={this.handleRoiDrawing}
        isSelected={this.state.isRoiDrawingActive}
        key='draw-roi-button'
      />,
      <Btn
        tooltip='Modify ROIs [Alt+M]'
        icon={FaHandPointer}
        onClick={this.handleRoiModification}
        isSelected={this.state.isRoiModificationActive}
        key='modify-roi-button'
      />,
      <Btn
        tooltip='Translate ROIs [Alt+T]'
        icon={FaHandPaper}
        onClick={this.handleRoiTranslation}
        isSelected={this.state.isRoiTranslationActive}
        key='translate-roi-button'
      />,
      <Btn
        tooltip='Remove selected ROI [Alt+R]'
        onClick={this.handleRoiRemoval}
        icon={FaTrash}
        key='remove-roi-button'
      />,
      <Btn
        tooltip='Show/Hide ROIs [Alt+V]'
        icon={this.state.areRoisHidden ? FaEye : FaEyeSlash}
        onClick={this.handleRoiVisibilityChange}
        isSelected={this.state.areRoisHidden}
        key='toggle-roi-visibility-button'
      />,
      <Btn
        tooltip='Save ROIs [Alt+S]'
        icon={FaSave}
        onClick={this.handleReportGeneration}
        key='generate-report-button'
      />
    ]
    const controlTools = [
      <Btn
        tooltip='Go to [Alt+G]'
        icon={FaCrosshairs}
        onClick={this.handleGoTo}
        key='go-to-slide-position-button'
      />
    ]

    let toolbar: React.ReactNode
    let toolbarHeight = '0px'

    if (this.props.enableAnnotationTools) {
      toolbar = (
        <Row justify='start'>
          {annotationTools.map((item, i) => {
            return <React.Fragment key={i}>{item}</React.Fragment>
          })}
          {controlTools.map((item, i) => {
            return <React.Fragment key={i}>{item}</React.Fragment>
          })}
        </Row>
      )
      toolbarHeight = '50px'
    }

    return { toolbar, toolbarHeight }
  }

  private readonly getCursor = (): string => {
    if (this.state.isLoading) {
      return 'progress'
    }
    return 'default'
  }

  private readonly getSelectedRoiInformation = (): React.ReactNode => {
    if (this.state.selectedRoi !== null && this.state.selectedRoi !== undefined) {
      const roiAttributes: Array<{
        name: string
        value: string
        unit?: string
      }> = [
        {
          name: 'UID',
          value: this.state.selectedRoi.uid
        }
      ]
      const roiScoordAttributes: Array<{
        name: string
        value: string
      }> = [
        {
          name: 'Graphic type',
          value: this.state.selectedRoi.scoord3d.graphicType
        }
      ]
      const roiEvaluationAttributes: Array<{
        name: string
        value: string
      }> = []
      this.state.selectedRoi.evaluations.forEach(item => {
        if (item.ValueType === 'CODE') {
          const codeItem = item as dcmjs.sr.valueTypes.CodeContentItem
          roiEvaluationAttributes.push({
            name: codeItem.ConceptNameCodeSequence[0].CodeMeaning,
            value: codeItem.ConceptCodeSequence[0].CodeMeaning
          })
        } else {
          const textItem = item as dcmjs.sr.valueTypes.TextContentItem
          roiEvaluationAttributes.push({
            name: textItem.ConceptNameCodeSequence[0].CodeMeaning,
            value: textItem.TextValue
          })
        }
      })
      const roiMeasurmentAttributesPerOpticalPath: {
        [identifier: string]: Array<{
          name: string
          value: string
          unit?: string
        }>
      } = {}
      this.state.selectedRoi.measurements.forEach(item => {
        let identifier = 'default'
        if (item.ContentSequence !== null && item.ContentSequence !== undefined) {
          const refItems = findContentItemsByName({
            content: item.ContentSequence,
            name: new dcmjs.sr.coding.CodedConcept({
              value: '121112',
              meaning: 'Source of Measurement',
              schemeDesignator: 'DCM'
            })
          })
          if (refItems.length > 0) {
            identifier = (
              refItems[0]
                // @ts-expect-error
                .ReferencedSOPSequence[0]
                .ReferencedOpticalPathIdentifier
            )
          }
        }
        if (!(identifier in roiMeasurmentAttributesPerOpticalPath)) {
          roiMeasurmentAttributesPerOpticalPath[identifier] = []
        }
        const measuredValueItem = item.MeasuredValueSequence[0]
        roiMeasurmentAttributesPerOpticalPath[identifier].push({
          name: item.ConceptNameCodeSequence[0].CodeMeaning,
          value: measuredValueItem.NumericValue.toString(),
          unit: measuredValueItem.MeasurementUnitsCodeSequence[0].CodeMeaning
        })
      })
      const createRoiDescription = (
        attributes: Array<{ name: string, value: string, unit?: string }>
      ): React.ReactNode[] => {
        return attributes.map(item => {
          let value
          if (item.unit !== null && item.unit !== undefined) {
            value = `${item.value} [${item.unit}]`
          } else {
            value = item.value
          }
          return (
            <Descriptions.Item
              key={item.name}
              label={item.name}
            >
              {value}
            </Descriptions.Item>
          )
        })
      }
      const roiDescriptions = createRoiDescription(roiAttributes)
      const roiScoordDescriptions = createRoiDescription(
        roiScoordAttributes
      )
      const roiEvaluationDescriptions = createRoiDescription(
        roiEvaluationAttributes
      )
      const roiMeasurementDescriptions = []
      for (const identifier in roiMeasurmentAttributesPerOpticalPath) {
        const descriptions = createRoiDescription(
          roiMeasurmentAttributesPerOpticalPath[identifier]
        )
        if (identifier === 'default') {
          roiMeasurementDescriptions.push(descriptions)
        } else {
          roiMeasurementDescriptions.push(
            <>
              <Divider orientation='left' orientationMargin={0} dashed plain>
                {identifier}
              </Divider>
              {descriptions}
            </>
          )
        }
      }
      return (
        <>
          <Descriptions layout='horizontal' column={1}>
            {roiDescriptions}
          </Descriptions>
          <Divider orientation='left' orientationMargin={0}>
            Spatial coordinates
          </Divider>
          <Descriptions layout='horizontal' column={1}>
            {roiScoordDescriptions}
          </Descriptions>
          <Divider orientation='left' orientationMargin={0}>
            Evaluations
          </Divider>
          <Descriptions layout='horizontal' column={1}>
            {roiEvaluationDescriptions}
          </Descriptions>
          <Divider orientation='left' orientationMargin={0}>
            Measurements
          </Divider>
          <Descriptions layout='horizontal' column={1}>
            {roiMeasurementDescriptions}
          </Descriptions>
        </>
      )
    }
    return undefined
  }

  private readonly getICCProfilesMenu = (): React.ReactNode => {
    return this.volumeViewer.getICCProfiles().length > 0 && (
      <div style={{ margin: '0.9rem' }}>
        <Checkbox
          checked={this.state.isICCProfilesEnabled}
          onChange={this.handleICCProfilesToggle}
        >
          ICC Profiles
        </Checkbox>
      </div>
    )
  }

  render = (): React.ReactNode => {
    const { rois, segments, mappings, annotationGroups, annotations } = this.getDataFromViewer()

    const openSubMenuItems = SlideViewer.getOpenSubMenuItems()
    const report = this.getReport()
    const annotationMenuItems = this.getAnnotationMenuItems(rois)
    const annotationConfigurations = this.getAnnotationConfigurations()
    const specimenMenu = this.getSpecimenMenu()
    const equipmentMenu = this.getEquipmentMenu()
    const opticalPathMenu = this.getOpticalPathMenu()
    const presentationStateMenu = this.getPresentationStateMenu()
    const segmentationMenu = this.getSegmentationMenu(segments)
    const parametricMapMenu = this.getParametricMapMenu(mappings)
    const annotationGroupMenu = this.getAnnotationGroupMenu(annotationGroups)
    const { toolbar, toolbarHeight } = this.getToolbar()
    const cursor = this.getCursor()
    const selectedRoiInformation = this.getSelectedRoiInformation()
    const iccProfilesMenu = this.getICCProfilesMenu()

    // Add segmentations and parametric maps to open sub menu items if they exist
    if (segmentationMenu !== null && segmentationMenu !== undefined) {
      openSubMenuItems.push('segmentations')
    }
    if (parametricMapMenu !== null && parametricMapMenu !== undefined) {
      openSubMenuItems.push('parametric-maps')
    }
    if (annotationGroupMenu !== null && annotationGroupMenu !== undefined) {
      openSubMenuItems.push('annotationGroups')
    }

    // Format annotations
    annotations?.forEach?.(this.formatAnnotation)

    return (
      <Layout style={{ height: '100%' }} hasSider>
        <SlideViewerContent
          toolbar={toolbar}
          toolbarHeight={toolbarHeight}
          cursor={cursor}
          volumeViewportRef={this.volumeViewportRef}
        >
          <SlideViewerModals
            isAnnotationModalVisible={this.state.isAnnotationModalVisible}
            onAnnotationConfigurationCompletion={this.handleAnnotationConfigurationCompletion}
            onAnnotationConfigurationCancellation={this.handleAnnotationConfigurationCancellation}
            isAnnotationOkDisabled={!(this.state.selectedFinding !== undefined && this.state.selectedGeometryType !== undefined)}
            annotationConfigurations={annotationConfigurations}
            isSelectedRoiModalVisible={this.state.isSelectedRoiModalVisible}
            onRoiSelectionCancellation={this.handleRoiSelectionCancellation}
            selectedRoiInformation={selectedRoiInformation}
            isGoToModalVisible={this.state.isGoToModalVisible}
            onSlidePositionSelection={this.handleSlidePositionSelection}
            onSlidePositionSelectionCancellation={this.handleSlidePositionSelectionCancellation}
            validXCoordinateRange={this.state.validXCoordinateRange}
            validYCoordinateRange={this.state.validYCoordinateRange}
            isSelectedXCoordinateValid={this.state.isSelectedXCoordinateValid}
            isSelectedYCoordinateValid={this.state.isSelectedYCoordinateValid}
            isSelectedMagnificationValid={this.state.isSelectedMagnificationValid}
            onXCoordinateSelection={this.handleXCoordinateSelection}
            onYCoordinateSelection={this.handleYCoordinateSelection}
            onMagnificationSelection={this.handleMagnificationSelection}
            isReportModalVisible={this.state.isReportModalVisible}
            onReportVerification={this.handleReportVerification}
            onReportCancellation={this.handleReportCancellation}
            report={report}
          />
        </SlideViewerContent>

        <SlideViewerSidebar
          labelViewportRef={this.labelViewportRef}
          labelViewer={this.labelViewer}
          openSubMenuItems={openSubMenuItems}
          specimenMenu={specimenMenu}
          iccProfilesMenu={iccProfilesMenu}
          equipmentMenu={equipmentMenu}
          opticalPathMenu={opticalPathMenu}
          presentationStateMenu={presentationStateMenu}
          annotationMenuItems={annotationMenuItems}
          annotationGroupMenu={annotationGroupMenu}
          segmentationMenu={segmentationMenu}
          parametricMapMenu={parametricMapMenu}
          annotations={annotations}
          visibleRoiUIDs={this.state.visibleRoiUIDs}
          onAnnotationVisibilityChange={this.handleAnnotationVisibilityChange}
          onRoiStyleChange={this.handleRoiStyleChange}
          defaultAnnotationStyles={this.defaultAnnotationStyles}
        />

        {this.state.isHoveredRoiTooltipVisible &&
        this.state.hoveredRoiAttributes.length > 0
          ? (
            <HoveredRoiTooltip
              xPosition={this.state.hoveredRoiTooltipX}
              yPosition={this.state.hoveredRoiTooltipY}
              rois={this.state.hoveredRoiAttributes}
            />
            )
          : null}
      </Layout>
    )
  }
}

export default withRouter(SlideViewer)
