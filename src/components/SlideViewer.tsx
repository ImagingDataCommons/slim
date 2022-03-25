import React from 'react'
import {
  RouteComponentProps,
  withRouter
} from 'react-router-dom'
import {
  FaDrawPolygon,
  FaEye,
  FaEyeSlash,
  FaHandPaper,
  FaHandPointer,
  FaTrash,
  FaSave
} from 'react-icons/fa'
import {
  Checkbox,
  message,
  Menu,
  Modal,
  Layout,
  Row,
  Select,
  Space
} from 'antd'
import * as dmv from 'dicom-microscopy-viewer'
import * as dcmjs from 'dcmjs'
import * as dwc from 'dicomweb-client'

import DicomWebManager from '../DicomWebManager'
import AnnotationList from './AnnotationList'
import AnnotationGroupList from './AnnotationGroupList'
import Button from './Button'
import Report, { MeasurementReport } from './Report'
import SpecimenList from './SpecimenList'
import OpticalPathList from './OpticalPathList'
import MappingList from './MappingList'
import SegmentList from './SegmentList'
import { AnnotationSettings } from '../AppConfig'
import { findContentItemsByName } from '../utils/sr'
import { Slide } from '../data/slides'
import { SOPClassUIDs } from '../data/uids'

const _buildKey = (concept: dcmjs.sr.coding.CodedConcept): string => {
  const codingScheme = concept.CodingSchemeDesignator
  const codeValue = concept.CodeValue
  return `${codingScheme}-${codeValue}`
}

const _getRoiKey = (roi: dmv.roi.ROI): string => {
  const matches = findContentItemsByName({
    content: roi.evaluations,
    name: new dcmjs.sr.coding.CodedConcept({
      value: '121071',
      meaning: 'Finding',
      schemeDesignator: 'DCM'
    })
  })
  if (matches.length === 0) {
    throw new Error(`No finding found for ROI ${roi.uid}`)
  }
  const finding = matches[0] as dcmjs.sr.valueTypes.CodeContentItem
  const findingName = finding.ConceptCodeSequence[0]
  return _buildKey(findingName)
}

const _areROIsEqual = (a: dmv.roi.ROI, b: dmv.roi.ROI): boolean => {
  if (a.scoord3d.graphicType !== b.scoord3d.graphicType) {
    return false
  }
  if (a.scoord3d.frameOfReferenceUID !== b.scoord3d.frameOfReferenceUID) {
    return false
  }
  if (a.scoord3d.graphicData.length !== b.scoord3d.graphicData.length) {
    return false
  }

  const decimals = 6
  for (let i = 0; i < a.scoord3d.graphicData.length; ++i) {
    if (a.scoord3d.graphicType === 'POINT') {
      const s1 = a.scoord3d as dmv.scoord3d.Point
      const s2 = b.scoord3d as dmv.scoord3d.Point
      const c1 = s1.graphicData[i].toPrecision(decimals)
      const c2 = s2.graphicData[i].toPrecision(decimals)
      if (c1 !== c2) {
        return false
      }
    } else {
      const s1 = a.scoord3d as dmv.scoord3d.Polygon
      const s2 = b.scoord3d as dmv.scoord3d.Polygon
      for (let j = 0; j < s1.graphicData[i].length; ++j) {
        const c1 = s1.graphicData[i][j].toPrecision(decimals)
        const c2 = s2.graphicData[i][j].toPrecision(decimals)
        if (c1 !== c2) {
          return false
        }
      }
    }
  }
  return true
}

const _constructViewers = ({ client, slide }: {
  client: dwc.api.DICOMwebClient
  slide: Slide
}): {
  volumeViewer: dmv.viewer.VolumeImageViewer
  labelViewer?: dmv.viewer.LabelImageViewer
} => {
  const volumeViewer = new dmv.viewer.VolumeImageViewer({
    client: client,
    metadata: slide.volumeImages
  })
  volumeViewer.toggleOverviewMap()
  volumeViewer.activateSelectInteraction({})

  let labelViewer
  if (slide.labelImages.length > 0) {
    labelViewer = new dmv.viewer.LabelImageViewer({
      client: client,
      metadata: slide.labelImages[0],
      resizeFactor: 1,
      orientation: 'vertical'
    })
  }

  return { volumeViewer, labelViewer }
}

/*
 * Check whether the report is structured according to template
 * TID 1500 "MeasurementReport".
 */
const _implementsTID1500 = (
  report: dmv.metadata.Comprehensive3DSR
): boolean => {
  const templateSeq = report.ContentTemplateSequence
  if (templateSeq.length > 0) {
    const tid = templateSeq[0].TemplateIdentifier
    if (tid === '1500') {
      return true
    }
  }
  return false
}

/*
 * Check whether the subject described in the report is a specimen as compared
 * to a patient, fetus, or device.
 */
const _describesSpecimenSubject = (
  report: dmv.metadata.Comprehensive3DSR
): boolean => {
  const items = findContentItemsByName({
    content: report.ContentSequence,
    name: new dcmjs.sr.coding.CodedConcept({
      value: '121024',
      schemeDesignator: 'DCM',
      meaning: 'Subject Class'
    })
  })
  if (items.length === 0) {
    return false
  }
  const subjectClassItem = items[0] as dcmjs.sr.valueTypes.CodeContentItem
  const subjectClassValue = subjectClassItem.ConceptCodeSequence[0]
  const retrievedConcept = new dcmjs.sr.coding.CodedConcept({
    value: subjectClassValue.CodeValue,
    meaning: subjectClassValue.CodeMeaning,
    schemeDesignator: subjectClassValue.CodingSchemeDesignator
  })
  const expectedConcept = new dcmjs.sr.coding.CodedConcept({
    value: '121027',
    meaning: 'Specimen',
    schemeDesignator: 'DCM'
  })
  if (retrievedConcept.equals(expectedConcept)) {
    return true
  }
  return false
}

/*
 * Check whether the report contains appropriate graphic ROI annotations.
 */
const _containsROIAnnotations = (
  report: dmv.metadata.Comprehensive3DSR
): boolean => {
  const measurements = findContentItemsByName({
    content: report.ContentSequence,
    name: new dcmjs.sr.coding.CodedConcept({
      value: '126010',
      schemeDesignator: 'DCM',
      meaning: 'Imaging Measurements'
    })
  })
  if (measurements.length === 0) {
    return false
  }
  const container = measurements[0] as dcmjs.sr.valueTypes.ContainerContentItem
  const measurementGroups = findContentItemsByName({
    content: container.ContentSequence,
    name: new dcmjs.sr.coding.CodedConcept({
      value: '125007',
      schemeDesignator: 'DCM',
      meaning: 'Measurement Group'
    })
  })

  let foundRegion = false
  measurementGroups.forEach((group) => {
    const container = group as dcmjs.sr.valueTypes.ContainerContentItem
    const regions = findContentItemsByName({
      content: container.ContentSequence,
      name: new dcmjs.sr.coding.CodedConcept({
        value: '111030',
        schemeDesignator: 'DCM',
        meaning: 'Image Region'
      })
    })
    if (regions.length > 0) {
      if (regions[0].ValueType === dcmjs.sr.valueTypes.ValueTypes.SCOORD3D) {
        foundRegion = true
      }
    }
  })

  return foundRegion
}

interface EvaluationOptions {
  name: dcmjs.sr.coding.CodedConcept
  values: dcmjs.sr.coding.CodedConcept[]
}

interface Evaluation {
  name: dcmjs.sr.coding.CodedConcept
  value: dcmjs.sr.coding.CodedConcept
}

interface SlideViewerProps extends RouteComponentProps {
  slide: Slide
  client: DicomWebManager
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
  user?: {
    name: string
    email: string
  }
}

interface SlideViewerState {
  selectedRoiUIDs: string[]
  visibleRoiUIDs: string[]
  visibleSegmentUIDs: string[]
  visibleMappingUIDs: string[]
  visibleAnnotationGroupUIDs: string[]
  visibleOpticalPathIdentifiers: string[]
  activeOpticalPathIdentifiers: string[]
  selectedFinding?: dcmjs.sr.coding.CodedConcept
  selectedEvaluations: Evaluation[]
  selectedGeometryType?: string
  selectedMarkup?: string
  generatedReport?: dmv.metadata.Comprehensive3DSR
  isLoading: boolean
  isAnnotationModalVisible: boolean
  isReportModalVisible: boolean
  isRoiDrawingActive: boolean
  isRoiModificationActive: boolean
  isRoiTranslationActive: boolean
  areRoisHidden: boolean
}

/**
 * React component for interactive viewing of an individual digital slide,
 * which corresponds to one DICOM Series of DICOM Slide Microscopy images and
 * potentially one or more associated DICOM Series of DICOM SR documents.
 */
class SlideViewer extends React.Component<SlideViewerProps, SlideViewerState> {
  private readonly findingOptions: dcmjs.sr.coding.CodedConcept[] = []

  private readonly evaluationOptions: { [key: string]: EvaluationOptions[] } = {}

  private readonly volumeViewportRef: React.RefObject<HTMLDivElement>

  private readonly labelViewportRef: React.RefObject<HTMLDivElement>

  private volumeViewer: dmv.viewer.VolumeImageViewer

  private labelViewer?: dmv.viewer.LabelImageViewer

  private readonly defaultRoiStyle: dmv.viewer.ROIStyleOptions = {
    stroke: {
      color: [0, 126, 163],
      width: 2
    },
    fill: {
      color: [0, 126, 163, 0.1]
    }
  }

  private roiStyles: {[key: string]: dmv.viewer.ROIStyleOptions} = {}

  private readonly selectionColor: number[] = [140, 184, 198]

  private readonly selectedRoiStyle: {
    stroke?: { color: number[], width: number }
    fill?: { color: number[] }
  } = {
    stroke: { color: [...this.selectionColor, 1], width: 3 },
    fill: { color: [...this.selectionColor, 0.2] }
  }

  constructor (props: SlideViewerProps) {
    super(props)
    props.annotations.forEach((annotation: AnnotationSettings) => {
      const finding = new dcmjs.sr.coding.CodedConcept(annotation.finding)
      this.findingOptions.push(finding)
      const key = _buildKey(finding)
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
      if (annotation.style != null) {
        this.roiStyles[key] = annotation.style
      } else {
        this.roiStyles[key] = this.defaultRoiStyle
      }
    })

    this.componentSetup = this.componentSetup.bind(this)
    this.componentCleanup = this.componentCleanup.bind(this)

    this.handleRoiDrawing = this.handleRoiDrawing.bind(this)
    this.handleRoiTranslation = this.handleRoiTranslation.bind(this)
    this.handleRoiModification = this.handleRoiModification.bind(this)
    this.handleRoiVisibilityChange = this.handleRoiVisibilityChange.bind(this)
    this.handleRoiRemoval = this.handleRoiRemoval.bind(this)
    this.handleAnnotationConfigurationCancellation = this.handleAnnotationConfigurationCancellation.bind(this)
    this.handleAnnotationGeometryTypeSelection = this.handleAnnotationGeometryTypeSelection.bind(this)
    this.handleAnnotationMeasurementActivation = this.handleAnnotationMeasurementActivation.bind(this)
    this.handleAnnotationFindingSelection = this.handleAnnotationFindingSelection.bind(this)
    this.handleAnnotationEvaluationSelection = this.handleAnnotationEvaluationSelection.bind(this)
    this.handleAnnotationEvaluationClearance = this.handleAnnotationEvaluationClearance.bind(this)
    this.handleAnnotationConfigurationCompletion = this.handleAnnotationConfigurationCompletion.bind(this)
    this.handleAnnotationSelection = this.handleAnnotationSelection.bind(this)
    this.handleAnnotationVisibilityChange = this.handleAnnotationVisibilityChange.bind(this)
    this.handleAnnotationGroupVisibilityChange = this.handleAnnotationGroupVisibilityChange.bind(this)
    this.handleAnnotationGroupStyleChange = this.handleAnnotationGroupStyleChange.bind(this)
    this.handleReportGeneration = this.handleReportGeneration.bind(this)
    this.handleReportVerification = this.handleReportVerification.bind(this)
    this.handleReportCancellation = this.handleReportCancellation.bind(this)
    this.handleSegmentVisibilityChange = this.handleSegmentVisibilityChange.bind(this)
    this.handleSegmentStyleChange = this.handleSegmentStyleChange.bind(this)
    this.handleMappingVisibilityChange = this.handleMappingVisibilityChange.bind(this)
    this.handleMappingStyleChange = this.handleMappingStyleChange.bind(this)
    this.handleOpticalPathVisibilityChange = this.handleOpticalPathVisibilityChange.bind(this)
    this.handleOpticalPathStyleChange = this.handleOpticalPathStyleChange.bind(this)
    this.handleOpticalPathActivityChange = this.handleOpticalPathActivityChange.bind(this)

    console.info(
      'instantiate viewers for slide of series ' +
      this.props.seriesInstanceUID
    )
    const { volumeViewer, labelViewer } = _constructViewers({
      client: this.props.client,
      slide: this.props.slide
    })
    this.volumeViewer = volumeViewer
    this.labelViewer = labelViewer
    this.volumeViewportRef = React.createRef<HTMLDivElement>()
    this.labelViewportRef = React.createRef<HTMLDivElement>()

    const activeOpticalPathIdentifiers: string[] = []
    const visibleOpticalPathIdentifiers: string[] = []
    this.volumeViewer.getAllOpticalPaths().forEach(opticalPath => {
      const identifier = opticalPath.identifier
      if (this.volumeViewer.isOpticalPathVisible(identifier)) {
        visibleOpticalPathIdentifiers.push(identifier)
      }
      if (this.volumeViewer.isOpticalPathActive(identifier)) {
        activeOpticalPathIdentifiers.push(identifier)
      }
    })

    this.state = {
      selectedRoiUIDs: [],
      visibleRoiUIDs: [],
      visibleSegmentUIDs: [],
      visibleMappingUIDs: [],
      visibleAnnotationGroupUIDs: [],
      visibleOpticalPathIdentifiers,
      activeOpticalPathIdentifiers,
      selectedFinding: undefined,
      selectedEvaluations: [],
      generatedReport: undefined,
      isLoading: false,
      isAnnotationModalVisible: false,
      isReportModalVisible: false,
      isRoiDrawingActive: false,
      isRoiTranslationActive: false,
      isRoiModificationActive: false,
      areRoisHidden: false
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
      this.props.client !== previousProps.client
    ) {
      this.volumeViewer.cleanup()
      if (this.labelViewer != null) {
        this.labelViewer.cleanup()
      }
      const { volumeViewer, labelViewer } = _constructViewers({
        client: this.props.client,
        slide: this.props.slide
      })
      this.volumeViewer = volumeViewer
      this.labelViewer = labelViewer

      const activeOpticalPathIdentifiers: string[] = []
      const visibleOpticalPathIdentifiers: string[] = []
      this.volumeViewer.getAllOpticalPaths().forEach(opticalPath => {
        const identifier = opticalPath.identifier
        if (this.volumeViewer.isOpticalPathVisible(identifier)) {
          visibleOpticalPathIdentifiers.push(identifier)
        }
        if (this.volumeViewer.isOpticalPathActive(identifier)) {
          activeOpticalPathIdentifiers.push(identifier)
        }
      })
      this.setState({
        visibleRoiUIDs: [],
        visibleSegmentUIDs: [],
        visibleMappingUIDs: [],
        visibleAnnotationGroupUIDs: [],
        visibleOpticalPathIdentifiers,
        activeOpticalPathIdentifiers
      })
      this.populateViewports()
    }
  }

  getRoiStyle = (key: string): dmv.viewer.ROIStyleOptions => {
    if (this.roiStyles[key] !== undefined) {
      return this.roiStyles[key]
    }
    return this.defaultRoiStyle
  }

  /**
   * Retrieve Structured Report instances that contain regions of interests
   * with 3D spatial coordinates defined in the same frame of reference as the
   * currently selected series and add them to the VOLUME image viewer.
   */
  addAnnotations = (): void => {
    console.info('search for Comprehensive 3D SR instances')
    this.props.client.searchForInstances({
      studyInstanceUID: this.props.studyInstanceUID,
      queryParams: {
        Modality: 'SR'
      }
    }).then((matchedInstances): void => {
      if (matchedInstances == null) {
        matchedInstances = []
      }
      matchedInstances.forEach(i => {
        const { dataset } = dmv.metadata.formatMetadata(i)
        const instance = dataset as dmv.metadata.Instance
        if (instance.SOPClassUID === SOPClassUIDs.COMPREHENSIVE_3D_SR) {
          console.info(`retrieve SR instance "${instance.SOPInstanceUID}"`)
          this.props.client.retrieveInstance({
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
            if (!_implementsTID1500(report)) {
              console.debug(
                `ignore SR document "${report.SOPInstanceUID}" ` +
                'because it is not structured according to template ' +
                'TID 1500 "MeasurementReport"'
              )
              return
            }
            if (!_describesSpecimenSubject(report)) {
              console.debug(
                `ignore SR document "${report.SOPInstanceUID}" ` +
                'because it does not describe a specimen subject'
              )
              return
            }
            if (!_containsROIAnnotations(report)) {
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
                    return _areROIsEqual(otherROI, roi)
                  }
                )
                if (!doesROIExist) {
                  try {
                    // Add ROI without style such that it won't be visible.
                    this.volumeViewer.addROI(roi, {})
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
          }).catch((error) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            message.error('Annotations could not be loaded')
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
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.error('Annotations could not be loaded')
      console.error(error)
    })
  }

  /**
   * Retrieve Microscopy Bulk Simple Annotations instances that contain
   * annotation groups defined in the same frame of reference as the currently
   * selected series and add them to the VOLUME image viewer.
   */
  addAnnotationGroups = (): void => {
    console.info('search for Microscopy Bulk Simple Annotations instances')
    this.props.client.searchForSeries({
      studyInstanceUID: this.props.studyInstanceUID,
      queryParams: {
        Modality: 'ANN'
      }
    }).then((matchedSeries): void => {
      if (matchedSeries == null) {
        matchedSeries = []
      }
      matchedSeries.forEach(s => {
        const { dataset } = dmv.metadata.formatMetadata(s)
        const series = dataset as dmv.metadata.Series
        this.props.client.retrieveSeriesMetadata({
          studyInstanceUID: this.props.studyInstanceUID,
          seriesInstanceUID: series.SeriesInstanceUID
        }).then((retrievedMetadata): void => {
          let annotations: dmv.metadata.MicroscopyBulkSimpleAnnotations[]
          annotations = retrievedMetadata.map(metadata => {
            return new dmv.metadata.MicroscopyBulkSimpleAnnotations({
              metadata
            })
          })
          annotations = annotations.filter(ann => {
            const refImage = this.props.slide.volumeImages[0]
            return (
              ann.FrameOfReferenceUID === refImage.FrameOfReferenceUID &&
              ann.ContainerIdentifier === refImage.ContainerIdentifier
            )
          })
          annotations.forEach(ann => {
            try {
              this.volumeViewer.addAnnotationGroups(ann)
            } catch (error: any) {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              message.error(
                'Microscopy Bulk Simple Annotations cannot be displayed.'
              )
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              console.error('failed to add annotation groups: ', error)
            }
          })
          /*
           * React is not aware of the fact that annotation groups have been
           * added via the viewer (the underlying HTML viewport element is a
           * ref object) and won't show the annotation groups in the user
           * interface unless an update is forced.
           */
          this.forceUpdate()
        }).catch((error: any) => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          message.error(
            'Retrieval of metadata of Microscopy Bulk Simple Annotations ' +
            'instances failed.'
          )
          console.error(
            'failed to retrieve metadata of ' +
            'Microscopy Bulk Simple Annotations instances: ',
            error
          )
        })
      })
    }).catch((error: any) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.error(
        'Search for Microscopy Bulk Simple Annotations instances failed.'
      )
      console.error(
        'failed to search for Microscopy Bulk Simple Annotations instances: ',
        error
      )
    })
  }

  /**
   * Retrieve Segmentation instances that contain segments defined in the same
   * frame of reference as the currently selected series and add them to the
   * VOLUME image viewer.
   */
  addSegmentations = (): void => {
    console.info('search for Segmentation instances')
    this.props.client.searchForSeries({
      studyInstanceUID: this.props.studyInstanceUID,
      queryParams: {
        Modality: 'SEG'
      }
    }).then((matchedSeries): void => {
      if (matchedSeries == null) {
        matchedSeries = []
      }
      matchedSeries.forEach((s, i) => {
        const { dataset } = dmv.metadata.formatMetadata(s)
        const series = dataset as dmv.metadata.Series
        this.props.client.retrieveSeriesMetadata({
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
            } catch (error: any) {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              message.error('Segmentations cannot be displayed')
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
        }).catch((error: any) => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          message.error(
            'Retrieval of metadata of Segmentation instances failed.'
          )
          console.error(
            'failed to retrieve metadata of Segmentation instances: ',
            error
          )
        })
      })
    }).catch((error: any) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.error('Search for Segmentation instances failed.')
      console.error('failed to search for Segmentation instances: ', error)
    })
  }

  /**
   * Retrieve Parametric Map instances that contain mappings defined in the same
   * frame of reference as the currently selected series and add them to the
   * VOLUME image viewer.
   */
  addParametricMaps = (): void => {
    console.info('search for Parametric Map instances')
    this.props.client.searchForSeries({
      studyInstanceUID: this.props.studyInstanceUID,
      queryParams: {
        Modality: 'OT'
      }
    }).then((matchedSeries): void => {
      if (matchedSeries == null) {
        matchedSeries = []
      }
      matchedSeries.forEach(s => {
        const { dataset } = dmv.metadata.formatMetadata(s)
        const series = dataset as dmv.metadata.Series
        this.props.client.retrieveSeriesMetadata({
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
            }
          })
          if (parametricMaps.length > 0) {
            try {
              this.volumeViewer.addParameterMappings(parametricMaps)
            } catch (error: any) {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              message.error('Parametric Map cannot be displayed')
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
        }).catch((error: any) => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          message.error(
            'Retrieval of metadata of Parametric Map instances failed.'
          )
          console.error(
            'failed to retrieve metadata of Parametric Map instances: ', error
          )
        })
      })
    }).catch((error: any) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.error('Search for Parametric Map instances failed.')
      console.error('failed to search for Parametric Map instances: ', error)
    })
  }

  /**
   * Populate viewports of the VOLUME and LABEL image viewers.
   */
  populateViewports = (): void => {
    console.info('populate viewports...')
    this.setState({ isLoading: true })

    if (this.volumeViewportRef.current != null) {
      this.volumeViewportRef.current.innerHTML = ''
      this.volumeViewer.render({ container: this.volumeViewportRef.current })
    }
    if (
      this.labelViewportRef.current != null &&
      this.labelViewer != null
    ) {
      this.labelViewportRef.current.innerHTML = ''
      this.labelViewer.render({ container: this.labelViewportRef.current })
    }

    // State update will also ensure that the component is re-rendered.
    this.setState({ isLoading: false })

    this.addAnnotations()
    this.addAnnotationGroups()
    this.addSegmentations()
    this.addParametricMaps()
  }

  onRoiModified = (event: CustomEventInit): void => {
    // Update state to trigger rendering
    this.setState(state => ({
      visibleRoiUIDs: [...state.visibleRoiUIDs]
    }))
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
      const key = _buildKey(selectedFinding)
      const style = this.getRoiStyle(key)
      this.volumeViewer.addROI(roi, style)
      this.setState(state => ({
        visibleRoiUIDs: [...state.visibleRoiUIDs, roi.uid]
      }))
    } else {
      console.debug(`could not add ROI "${roi.uid}"`)
    }
  }

  onRoiSelected = (event: CustomEventInit): void => {
    const selectedRoi = event.detail.payload as dmv.roi.ROI
    if (selectedRoi !== null) {
      console.debug(`selected ROI "${selectedRoi.uid}"`)
      this.volumeViewer.setROIStyle(selectedRoi.uid, this.selectedRoiStyle)
      const key = _getRoiKey(selectedRoi)
      this.volumeViewer.getAllROIs().forEach((roi) => {
        if (roi.uid !== selectedRoi.uid) {
          this.volumeViewer.setROIStyle(roi.uid, this.getRoiStyle(key))
        }
      })
      this.setState({ selectedRoiUIDs: [selectedRoi.uid] })
    } else {
      this.setState({ selectedRoiUIDs: [] })
    }
  }

  onLoadingStarted = (event: CustomEventInit): void => {
    this.setState({ isLoading: true })
  }

  onLoadingEnded = (event: CustomEventInit): void => {
    this.setState({ isLoading: false })
  }

  onRoiRemoved = (event: CustomEventInit): void => {
    const roi = event.detail.payload as dmv.roi.ROI
    console.debug(`removed ROI "${roi.uid}"`)
  }

  componentCleanup (): void {
    document.body.removeEventListener(
      'dicommicroscopyviewer_roi_drawn',
      this.onRoiDrawn
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_roi_selected',
      this.onRoiSelected
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
    this.volumeViewer.cleanup()
    if (this.labelViewer != null) {
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

  componentWillUnmount (): void {
    window.removeEventListener('beforeunload', this.componentCleanup)
    this.componentCleanup()
  }

  componentSetup (): void {
    document.body.addEventListener(
      'dicommicroscopyviewer_roi_drawn',
      this.onRoiDrawn
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_roi_selected',
      this.onRoiSelected
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
  }

  componentDidMount (): void {
    window.addEventListener('beforeunload', this.componentCleanup)
    this.componentSetup()
    this.populateViewports()

    if (!this.props.slide.areVolumeImagesMonochrome) {
      let hasICCProfile = false
      const image = this.props.slide.volumeImages[0]
      const metadataItem = image.OpticalPathSequence[0]
      if (metadataItem.ICCProfile == null) {
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
  handleAnnotationFindingSelection (
    value: string,
    option: any
  ): void {
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
  handleAnnotationGeometryTypeSelection (value: string, option: any): void {
    this.setState({ selectedGeometryType: value })
  }

  /**
   * Handler that gets called when measurements have been selected for
   * annotation.
   */
  handleAnnotationMeasurementActivation (event: any): void {
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
  handleAnnotationEvaluationSelection (
    value: string,
    option: any
  ): void {
    const selectedFinding = this.state.selectedFinding
    if (selectedFinding !== undefined) {
      const key = _buildKey(selectedFinding)
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
  handleAnnotationEvaluationClearance (): void {
    this.setState({
      selectedEvaluations: []
    })
  }

  /**
   * Handler that gets called when annotation configuration has been completed.
   */
  handleAnnotationConfigurationCompletion (): void {
    console.debug('complete annotation configuration')
    const finding = this.state.selectedFinding
    const geometryType = this.state.selectedGeometryType
    const markup = this.state.selectedMarkup
    if (geometryType !== undefined && finding !== undefined) {
      this.volumeViewer.activateDrawInteraction({ geometryType, markup })
      this.setState({ isAnnotationModalVisible: false })
    } else {
      console.error('could not complete annotation configuration')
    }
  }

  /**
   * Handler that gets called when annotation configuration has been cancelled.
   */
  handleAnnotationConfigurationCancellation (): void {
    console.debug('cancel annotation configuration')
    this.setState({ isAnnotationModalVisible: false })
  }

  /**
   * Handler that gets called when a report should be generated for the current
   * set of annotations.
   */
  handleReportGeneration (): void {
    console.info('save ROIs')
    const rois = this.volumeViewer.getAllROIs()
    const opticalPaths = this.volumeViewer.getAllOpticalPaths()
    const metadata = this.volumeViewer.getOpticalPathMetadata(
      opticalPaths[0].identifier
    )
    // Metadata should be sorted such that the image with the highest
    // resolution is the last item in the array.
    const refImage = metadata[metadata.length - 1]
    // We assume that there is only one specimen (tissue section) per
    // ontainer (slide). Only the tissue section is tracked with a unique
    // identifier, even if the section may be composed of different biological
    // samples.
    if (refImage.SpecimenDescriptionSequence.length > 1) {
      console.error('more than one specimen has been described for the slide')
    }
    const refSpecimen = refImage.SpecimenDescriptionSequence[0]

    console.debug('create Observation Context')
    var observer
    if (this.props.user !== undefined) {
      observer = new dcmjs.sr.templates.PersonObserverIdentifyingAttributes({
        name: this.props.user.name,
        loginName: this.props.user.email
      })
    } else {
      console.warn('no user information available')
      observer = new dcmjs.sr.templates.PersonObserverIdentifyingAttributes({
        name: 'ANONYMOUS'
      })
    }
    const observationContext = new dcmjs.sr.templates.ObservationContext({
      observerPersonContext: new dcmjs.sr.templates.ObserverContext({
        observerType: new dcmjs.sr.coding.CodedConcept({
          value: '121006',
          schemeDesignator: 'DCM',
          meaning: 'Person'
        }),
        observerIdentifyingAttributes: observer
      }),
      observerDeviceContext: new dcmjs.sr.templates.ObserverContext({
        observerType: new dcmjs.sr.coding.CodedConcept({
          value: '121007',
          schemeDesignator: 'DCM',
          meaning: 'Device'
        }),
        observerIdentifyingAttributes:
          new dcmjs.sr.templates.DeviceObserverIdentifyingAttributes({
            uid: this.props.app.uid,
            manufacturerName: 'MGH Computational Pathology',
            modelName: this.props.app.name
          })
      }),
      subjectContext: new dcmjs.sr.templates.SubjectContext({
        subjectClass: new dcmjs.sr.coding.CodedConcept({
          value: '121027',
          schemeDesignator: 'DCM',
          meaning: 'Specimen'
        }),
        subjectClassSpecificContext:
          new dcmjs.sr.templates.SubjectContextSpecimen({
            uid: refSpecimen.SpecimenUID,
            identifier: refSpecimen.SpecimenIdentifier,
            containerIdentifier: refImage.ContainerIdentifier
          })
      })
    })

    console.debug('encode Imaging Measurements')
    const imagingMeasurements: dcmjs.sr.valueTypes.ContainerContentItem[] = []
    for (let i = 0; i < rois.length; i++) {
      const roi = rois[i]
      if (!this.state.visibleRoiUIDs.includes(roi.uid as never)) {
        continue
      }
      let findingType = roi.evaluations.find(
        (item: dcmjs.sr.valueTypes.ContentItem) => {
          return item.ConceptNameCodeSequence[0].CodeValue === '121071'
        }
      )
      if (findingType === undefined) {
        throw new Error(`No finding type was specified for ROI "${roi.uid}"`)
      }
      findingType = findingType as dcmjs.sr.valueTypes.CodeContentItem
      const group = new dcmjs.sr.templates.PlanarROIMeasurementsAndQualitativeEvaluations({
        trackingIdentifier: new dcmjs.sr.templates.TrackingIdentifier({
          uid: roi.properties.trackingUID ?? roi.uid,
          identifier: `ROI #${i + 1}`
        }),
        referencedRegion: new dcmjs.sr.contentItems.ImageRegion3D({
          graphicType: roi.scoord3d.graphicType,
          graphicData: roi.scoord3d.graphicData,
          frameOfReferenceUID: roi.scoord3d.frameOfReferenceUID
        }),
        findingType: new dcmjs.sr.coding.CodedConcept({
          value: findingType.ConceptCodeSequence[0].CodeValue,
          schemeDesignator:
            findingType.ConceptCodeSequence[0].CodingSchemeDesignator,
          meaning: findingType.ConceptCodeSequence[0].CodeMeaning
        }),
        qualitativeEvaluations: roi.evaluations.filter(
          (item: dcmjs.sr.valueTypes.ContentItem) => {
            return item.ConceptNameCodeSequence[0].CodeValue !== '121071'
          }
        ),
        measurements: roi.measurements
      })
      const measurements = group as dcmjs.sr.valueTypes.ContainerContentItem[]
      measurements[0].ContentTemplateSequence = [{
        MappingResource: 'DCMR',
        TemplateIdentifier: '1410'
      }]
      imagingMeasurements.push(...measurements)
    }

    console.debug('create Measurement Report document content')
    const measurementReport = new dcmjs.sr.templates.MeasurementReport({
      languageOfContentItemAndDescendants: new dcmjs.sr.templates.LanguageOfContentItemAndDescendants({}),
      observationContext: observationContext,
      procedureReported: new dcmjs.sr.coding.CodedConcept({
        value: '112703',
        schemeDesignator: 'DCM',
        meaning: 'Whole Slide Imaging'
      }),
      imagingMeasurements: imagingMeasurements
    })

    console.info('create Comprehensive 3D SR document')
    const dataset = new dcmjs.sr.documents.Comprehensive3DSR({
      content: measurementReport[0],
      evidence: [refImage],
      seriesInstanceUID: dcmjs.data.DicomMetaDictionary.uid(),
      seriesNumber: 1,
      seriesDescription: 'Annotation',
      sopInstanceUID: dcmjs.data.DicomMetaDictionary.uid(),
      instanceNumber: 1,
      manufacturer: 'MGH Computational Pathology',
      previousVersions: undefined // TODO
    })

    this.setState({
      isReportModalVisible: true,
      generatedReport: dataset as dmv.metadata.Comprehensive3DSR
    })
  }

  /**
   * Handler that gets called when a report should be verified. The current
   * list of annotations will be presented to the user together with other
   * pertinent metadata about the patient, study, and specimen.
   */
  handleReportVerification (): void {
    console.info('verfied report')

    const report = this.state.generatedReport
    if (report !== undefined) {
      var dataset = report as unknown as dmv.metadata.Comprehensive3DSR
      console.debug('create File Meta Information')
      const fileMetaInformationVersionArray = new Uint8Array(2)
      fileMetaInformationVersionArray[1] = 1
      const fileMeta = {
        // FileMetaInformationVersion
        '00020001': {
          Value: [fileMetaInformationVersionArray.buffer],
          vr: 'OB'
        },
        // MediaStorageSOPClassUID
        '00020002': {
          Value: [dataset.SOPClassUID],
          vr: 'UI'
        },
        // MediaStorageSOPInstanceUID
        '00020003': {
          Value: [dataset.SOPInstanceUID],
          vr: 'UI'
        },
        // TransferSyntaxUID
        '00020010': {
          Value: ['1.2.840.10008.1.2.1'],
          vr: 'UI'
        },
        // ImplementationClassUID
        '00020012': {
          Value: [this.props.app.uid],
          vr: 'UI'
        }
      }

      console.info('store Comprehensive 3D SR document')
      const writer = new dcmjs.data.DicomDict(fileMeta)
      writer.dict = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(dataset)
      const buffer = writer.write()
      this.props.client.storeInstances({ datasets: [buffer] }).then(
        (response: any) => message.info('Annotations were saved.')
      ).catch((error: any) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error('Annotations could not be saved')
        console.error(error)
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
  handleReportCancellation (): void {
    this.setState({
      isReportModalVisible: false,
      generatedReport: undefined
    })
  }

  /**
   * Handler that gets called when an annotation has been selected from the
   * current list of annotations.
   */
  handleAnnotationSelection ({ roiUID }: { roiUID: string }): void {
    console.log(`selected ROI ${roiUID}`)
    this.setState({ selectedRoiUIDs: [roiUID] })
    this.volumeViewer.getAllROIs().forEach((roi) => {
      var style = {}
      if (roi.uid === roiUID) {
        style = this.selectedRoiStyle
        this.setState(state => ({
          visibleRoiUIDs: [...state.visibleRoiUIDs, roiUID]
        }))
      } else {
        if (this.state.visibleRoiUIDs.includes(roi.uid as never)) {
          const key = _getRoiKey(roi)
          style = this.getRoiStyle(key)
        }
      }
      this.volumeViewer.setROIStyle(roi.uid, style)
    })
  }

  /**
   * Handle toggling of annotation visibility, i.e., whether a given
   * annotation should be either displayed or hidden by the viewer.
   */
  handleAnnotationVisibilityChange ({ roiUID, isVisible }: {
    roiUID: string
    isVisible: boolean
  }): void {
    if (isVisible) {
      console.info(`show ROI ${roiUID}`)
      const roi = this.volumeViewer.getROI(roiUID)
      const key = _getRoiKey(roi)
      this.volumeViewer.setROIStyle(roi.uid, this.getRoiStyle(key))
      this.setState(state => {
        if (!state.visibleRoiUIDs.includes(roiUID)) {
          return {
            visibleRoiUIDs: [...state.visibleRoiUIDs, roiUID]
          }
        } else {
          return {
            visibleRoiUIDs: state.visibleRoiUIDs
          }
        }
      })
    } else {
      console.info(`hide ROI ${roiUID}`)
      this.setState(state => ({
        visibleRoiUIDs: state.visibleRoiUIDs.filter(uid => uid !== roiUID),
        selectedRoiUIDs: state.selectedRoiUIDs.filter(uid => uid !== roiUID)
      }))
      this.volumeViewer.setROIStyle(roiUID, {})
    }
  }

  /**
   * Handle toggling of annotation group visibility, i.e., whether a given
   * annotation group should be either displayed or hidden by the viewer.
   */
  handleAnnotationGroupVisibilityChange ({ annotationGroupUID, isVisible }: {
    annotationGroupUID: string
    isVisible: boolean
  }): void {
    console.log(`change visibility of annotation group ${annotationGroupUID}`)
    if (isVisible) {
      console.info(`show annotation group ${annotationGroupUID}`)
      this.volumeViewer.showAnnotationGroup(annotationGroupUID)
      this.setState(state => ({
        visibleAnnotationGroupUIDs: state.visibleAnnotationGroupUIDs.concat(
          annotationGroupUID
        )
      }))
    } else {
      console.info(`hide annotation group ${annotationGroupUID}`)
      this.volumeViewer.hideAnnotationGroup(annotationGroupUID)
      this.setState(state => ({
        visibleAnnotationGroupUIDs: state.visibleAnnotationGroupUIDs.filter(
          uid => uid !== annotationGroupUID
        )
      }))
    }
  }

  /**
   * Handle change of annotation group style.
   */
  handleAnnotationGroupStyleChange ({ annotationGroupUID, styleOptions }: {
    annotationGroupUID: string
    styleOptions: {
      opacity?: number
    }
  }): void {
    console.log(`change style of annotation group ${annotationGroupUID}`)
    this.volumeViewer.setAnnotationGroupStyle(annotationGroupUID, styleOptions)
  }

  /**
   * Handle toggling of segment visibility, i.e., whether a given
   * segment should be either displayed or hidden by the viewer.
   */
  handleSegmentVisibilityChange ({ segmentUID, isVisible }: {
    segmentUID: string
    isVisible: boolean
  }): void {
    console.log(`change visibility of segment ${segmentUID}`)
    if (isVisible) {
      console.info(`show segment ${segmentUID}`)
      this.volumeViewer.showSegment(segmentUID)
      this.setState(state => ({
        visibleSegmentUIDs: state.visibleSegmentUIDs.concat(segmentUID)
      }))
    } else {
      console.info(`hide segment ${segmentUID}`)
      this.volumeViewer.hideSegment(segmentUID)
      this.setState(state => ({
        visibleSegmentUIDs: state.visibleSegmentUIDs.filter(uid => {
          return uid !== segmentUID
        })
      }))
    }
  }

  /**
   * Handle change of segment style.
   */
  handleSegmentStyleChange ({ segmentUID, styleOptions }: {
    segmentUID: string
    styleOptions: {
      opacity?: number
    }
  }): void {
    console.log(`change style of segment ${segmentUID}`)
    this.volumeViewer.setSegmentStyle(segmentUID, styleOptions)
  }

  /**
   * Handle toggling of mapping visibility, i.e., whether a given
   * mapping should be either displayed or hidden by the viewer.
   */
  handleMappingVisibilityChange ({ mappingUID, isVisible }: {
    mappingUID: string
    isVisible: boolean
  }): void {
    console.log(`change visibility of mapping ${mappingUID}`)
    if (isVisible) {
      console.info(`show mapping ${mappingUID}`)
      this.volumeViewer.showParameterMapping(mappingUID)
      this.setState(state => ({
        visibleMappingUIDs: state.visibleMappingUIDs.concat(mappingUID)
      }))
    } else {
      console.info(`hide mapping ${mappingUID}`)
      this.volumeViewer.hideParameterMapping(mappingUID)
      this.setState(state => ({
        visibleMappingUIDs: state.visibleMappingUIDs.filter(uid => {
          return uid !== mappingUID
        })
      }))
    }
  }

  /**
   * Handle change of mapping style.
   */
  handleMappingStyleChange ({ mappingUID, styleOptions }: {
    mappingUID: string
    styleOptions: {
      opacity?: number
    }
  }): void {
    console.log(`change style of mapping ${mappingUID}`)
    this.volumeViewer.setParameterMappingStyle(mappingUID, styleOptions)
  }

  /**
   * Handle toggling of optical path visibility, i.e., whether a given
   * optical path should be either displayed or hidden by the viewer.
   */
  handleOpticalPathVisibilityChange ({ opticalPathIdentifier, isVisible }: {
    opticalPathIdentifier: string
    isVisible: boolean
  }): void {
    console.log(`change visibility of optical path ${opticalPathIdentifier}`)
    if (isVisible) {
      console.info(`show optical path ${opticalPathIdentifier}`)
      this.volumeViewer.showOpticalPath(opticalPathIdentifier)
      this.setState(state => ({
        visibleOpticalPathIdentifiers:
          state.visibleOpticalPathIdentifiers.concat(opticalPathIdentifier)
      }))
    } else {
      console.info(`hide optical path ${opticalPathIdentifier}`)
      this.volumeViewer.hideOpticalPath(opticalPathIdentifier)
      this.setState(state => ({
        visibleOpticalPathIdentifiers:
          state.visibleOpticalPathIdentifiers.filter(
            identifier => identifier !== opticalPathIdentifier
          )
      }))
    }
  }

  /**
   * Handle change of optical path style.
   */
  handleOpticalPathStyleChange ({ opticalPathIdentifier, styleOptions }: {
    opticalPathIdentifier: string
    styleOptions: {
      opacity?: number
      color?: number[]
      limitValues?: number[]
    }
  }): void {
    console.log(`change style of optical path ${opticalPathIdentifier}`)
    this.volumeViewer.setOpticalPathStyle(opticalPathIdentifier, styleOptions)
  }

  /**
   * Handle toggling of optical path activity, i.e., whether a given
   * optical path should be either added or removed from the viewport.
   */
  handleOpticalPathActivityChange ({ opticalPathIdentifier, isActive }: {
    opticalPathIdentifier: string
    isActive: boolean
  }): void {
    console.log(`change activity of optical path ${opticalPathIdentifier}`)
    if (isActive) {
      console.info(`activate optical path ${opticalPathIdentifier}`)
      this.volumeViewer.activateOpticalPath(opticalPathIdentifier)
      this.setState(state => ({
        activeOpticalPathIdentifiers:
          state.activeOpticalPathIdentifiers.concat(opticalPathIdentifier)
      }))
    } else {
      console.info(`deactivate optical path ${opticalPathIdentifier}`)
      this.volumeViewer.deactivateOpticalPath(opticalPathIdentifier)
      this.setState(state => ({
        activeOpticalPathIdentifiers:
          state.activeOpticalPathIdentifiers.filter(
            identifier => identifier !== opticalPathIdentifier
          )
      }))
    }
  }

  /**
   * Handler that will toggle the ROI drawing tool, i.e., either activate or
   * de-activate it, depending on its current state.
   */
  handleRoiDrawing (): void {
    if (this.volumeViewer.isDrawInteractionActive) {
      console.info('deactivate drawing of ROIs')
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.activateSelectInteraction({})
      this.setState({
        isAnnotationModalVisible: false,
        isRoiTranslationActive: false,
        isRoiDrawingActive: false,
        isRoiModificationActive: false
      })
    } else {
      console.info('activate drawing of ROIs')
      this.setState({
        isAnnotationModalVisible: true,
        isRoiDrawingActive: true,
        isRoiModificationActive: false,
        isRoiTranslationActive: false
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
  handleRoiModification (): void {
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
  handleRoiTranslation (): void {
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

  /**
   * Handler that will toggle the ROI removal tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiRemoval (): void {
    this.volumeViewer.deactivateDrawInteraction()
    this.volumeViewer.deactivateSnapInteraction()
    this.volumeViewer.deactivateTranslateInteraction()
    this.volumeViewer.deactivateModifyInteraction()
    if (this.state.selectedRoiUIDs.length > 0) {
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
        selectedRoiUIDs: [],
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
        visibleRoiUIDs: [],
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
  handleRoiVisibilityChange (): void {
    console.info('toggle visibility of ROIs')
    if (this.volumeViewer.areROIsVisible) {
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

  render (): React.ReactNode {
    const rois: dmv.roi.ROI[] = []
    const segments: dmv.segment.Segment[] = []
    const mappings: dmv.mapping.ParameterMapping[] = []
    const annotationGroups: dmv.annotation.AnnotationGroup[] = []
    rois.push(...this.volumeViewer.getAllROIs())
    segments.push(...this.volumeViewer.getAllSegments())
    mappings.push(...this.volumeViewer.getAllParameterMappings())
    annotationGroups.push(...this.volumeViewer.getAllAnnotationGroups())

    const openSubMenuItems = ['specimens', 'opticalpaths', 'annotations']

    let report: React.ReactNode
    const dataset = this.state.generatedReport
    if (dataset !== undefined) {
      report = <Report dataset={dataset} />
    }

    let annotationMenuItems: React.ReactNode
    if (rois.length > 0) {
      annotationMenuItems = (
        <AnnotationList
          rois={rois}
          selectedRoiUIDs={this.state.selectedRoiUIDs}
          visibleRoiUIDs={this.state.visibleRoiUIDs}
          onSelection={this.handleAnnotationSelection}
          onVisibilityChange={this.handleAnnotationVisibilityChange}
        />
      )
    }

    const findingOptions = this.findingOptions.map(finding => {
      return (
        <Select.Option
          key={finding.CodeValue}
          value={finding.CodeValue}
        >
          {finding.CodeMeaning}
        </Select.Option>
      )
    })

    const geometryTypeOptions = [
      <Select.Option key='point' value='point'>Point</Select.Option>,
      <Select.Option key='circle' value='circle'>Circle</Select.Option>,
      <Select.Option key='box' value='box'>Rectangle</Select.Option>,
      <Select.Option key='polygon' value='polygon'>Polygon</Select.Option>,
      <Select.Option key='line' value='line'>Line</Select.Option>,
      (
        <Select.Option key='freehandpolygon' value='freehandpolygon'>
          Polygon (freehand)
        </Select.Option>
      ),
      (
        <Select.Option key='freehandline' value='freehandline'>
          Line (freehand)
        </Select.Option>
      )
    ]

    const selections: React.ReactNode[] = [
      (
        <Select
          style={{ minWidth: 130 }}
          onSelect={this.handleAnnotationGeometryTypeSelection}
          key='annotation-geometry-type'
        >
          {geometryTypeOptions}
        </Select>
      ),
      (
        <Checkbox
          onChange={this.handleAnnotationMeasurementActivation}
          key='annotation-measurement'
        >
          measure
        </Checkbox>
      ),
      (
        <Select
          style={{ minWidth: 130 }}
          onSelect={this.handleAnnotationFindingSelection}
          key='annotation-finding'
          defaultActiveFirstOption
        >
          {findingOptions}
        </Select>
      )
    ]

    const selectedFinding = this.state.selectedFinding
    if (selectedFinding !== undefined) {
      const key = _buildKey(selectedFinding)
      this.evaluationOptions[key].forEach(evaluation => {
        const evaluationOptions = evaluation.values.map(code => {
          return (
            <Select.Option
              key={code.CodeValue}
              value={code.CodeValue}
              label={evaluation.name}
            >
              {code.CodeMeaning}
            </Select.Option>
          )
        })
        selections.push(
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
    }

    const specimenMenu = (
      <Menu.SubMenu key='specimens' title='Specimens'>
        <SpecimenList
          metadata={this.props.slide.volumeImages[0]}
          showstain={false}
        />
      </Menu.SubMenu>
    )

    const defaultOpticalPathStyles: {
      [identifier: string]: {
        opacity: number
        color?: number[]
        limitValues?: number[]
      }
    } = {}
    const opticalPathMetadata: {
      [identifier: string]: dmv.metadata.VLWholeSlideMicroscopyImage[]
    } = {}
    const opticalPaths = this.volumeViewer.getAllOpticalPaths()
    opticalPaths.forEach(opticalPath => {
      const identifier = opticalPath.identifier
      const style = this.volumeViewer.getOpticalPathStyle(identifier)
      defaultOpticalPathStyles[identifier] = style
      opticalPathMetadata[identifier] = this.volumeViewer.getOpticalPathMetadata(
        identifier
      )
    })
    const opticalPathMenu = (
      <Menu.SubMenu key='opticalpaths' title='Optical Paths'>
        <OpticalPathList
          metadata={opticalPathMetadata}
          opticalPaths={opticalPaths}
          defaultOpticalPathStyles={defaultOpticalPathStyles}
          visibleOpticalPathIdentifiers={this.state.visibleOpticalPathIdentifiers}
          activeOpticalPathIdentifiers={this.state.activeOpticalPathIdentifiers}
          onOpticalPathVisibilityChange={this.handleOpticalPathVisibilityChange}
          onOpticalPathStyleChange={this.handleOpticalPathStyleChange}
          onOpticalPathActivityChange={this.handleOpticalPathActivityChange}
        />
      </Menu.SubMenu>
    )

    let segmentationMenu
    if (segments.length > 0) {
      const defaultSegmentStyles: {
        [segmentUID: string]: {
          opacity: number
        }
      } = {}
      const segmentMetadata: {
        [segmentUID: string]: dmv.metadata.Segmentation[]
      } = {}
      const segments = this.volumeViewer.getAllSegments()
      segments.forEach(segment => {
        defaultSegmentStyles[segment.uid] = this.volumeViewer.getSegmentStyle(
          segment.uid
        )
        segmentMetadata[segment.uid] = this.volumeViewer.getSegmentMetadata(
          segment.uid
        )
      })
      segmentationMenu = (
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
      openSubMenuItems.push('segmentations')
    }

    let parametricMapMenu
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
      parametricMapMenu = (
        <Menu.SubMenu key='parmetricmaps' title='Parametric Maps'>
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
      openSubMenuItems.push('parametricmaps')
    }

    let annotationGroupMenu
    if (annotationGroups.length > 0) {
      const defaultAnnotationGroupStyles: {
        [annotationGroupUID: string]: {
          opacity: number
        }
      } = {}
      const annotationGroupMetadata: {
        [annotationGroupUID: string]: dmv.metadata.MicroscopyBulkSimpleAnnotations
      } = {}
      const annotationGroups = this.volumeViewer.getAllAnnotationGroups()
      annotationGroups.forEach(annotationGroup => {
        defaultAnnotationGroupStyles[annotationGroup.uid] = this.volumeViewer.getAnnotationGroupStyle(
          annotationGroup.uid
        )
        annotationGroupMetadata[annotationGroup.uid] = this.volumeViewer.getAnnotationGroupMetadata(
          annotationGroup.uid
        )
      })
      annotationGroupMenu = (
        <Menu.SubMenu key='annotationGroups' title='Annotation Groups'>
          <AnnotationGroupList
            annotationGroups={annotationGroups}
            metadata={annotationGroupMetadata}
            defaultAnnotationGroupStyles={defaultAnnotationGroupStyles}
            visibleAnnotationGroupUIDs={this.state.visibleAnnotationGroupUIDs}
            onAnnotationGroupVisibilityChange={this.handleAnnotationGroupVisibilityChange}
            onAnnotationGroupStyleChange={this.handleAnnotationGroupStyleChange}
          />
        </Menu.SubMenu>
      )
      openSubMenuItems.push('annotationGroups')
    }

    let toolbar
    let toolbarHeight = '0px'
    if (this.props.enableAnnotationTools) {
      toolbar = (
        <Row>
          <Button
            tooltip='Draw ROI'
            icon={FaDrawPolygon}
            onClick={this.handleRoiDrawing}
            isSelected={this.state.isRoiDrawingActive}
          />
          <Button
            tooltip='Modify ROIs'
            icon={FaHandPointer}
            onClick={this.handleRoiModification}
            isSelected={this.state.isRoiModificationActive}
          />
          <Button
            tooltip='Shift ROIs'
            icon={FaHandPaper}
            onClick={this.handleRoiTranslation}
            isSelected={this.state.isRoiTranslationActive}
          />
          <Button
            tooltip='Remove selected ROI'
            onClick={this.handleRoiRemoval}
            icon={FaTrash}
          />
          <Button
            tooltip='Show/Hide ROIs'
            icon={this.state.areRoisHidden ? FaEye : FaEyeSlash}
            onClick={this.handleRoiVisibilityChange}
            isSelected={this.state.areRoisHidden}
          />
          <Button
            tooltip='Save ROIs'
            icon={FaSave}
            onClick={this.handleReportGeneration}
          />
        </Row>
      )
      toolbarHeight = '50px'
    }

    /* It would be nicer to use the ant Spin component, but that causes issues
     * with the positioning of the viewport.
     */
    let loadingDisplay = 'none'
    if (this.state.isLoading) {
      loadingDisplay = 'block'
    }

    return (
      <Layout style={{ height: '100%' }} hasSider>
        <Layout.Content style={{ height: '100%' }}>
          {toolbar}

          <div className='dimmer' style={{ display: loadingDisplay }} />
          <div className='spinner' style={{ display: loadingDisplay }} />
          <div
            style={{
              height: `calc(100% - ${toolbarHeight})`,
              overflow: 'hidden'
            }}
            ref={this.volumeViewportRef}
          />

          <Modal
            visible={this.state.isAnnotationModalVisible}
            title='Configure annotations'
            onOk={this.handleAnnotationConfigurationCompletion}
            onCancel={this.handleAnnotationConfigurationCancellation}
            okText='Select'
          >
            <Space align='start' direction='vertical'>
              {selections}
            </Space>
          </Modal>

          <Modal
            visible={this.state.isReportModalVisible}
            title='Verify and save report'
            onOk={this.handleReportVerification}
            onCancel={this.handleReportCancellation}
            okText='Save'
          >
            {report}
          </Modal>
        </Layout.Content>

        <Layout.Sider
          width={300}
          reverseArrow
          style={{
            borderLeft: 'solid',
            borderLeftWidth: 0.25,
            overflow: 'hidden',
            background: 'none'
          }}
        >
          <Menu
            mode='inline'
            defaultOpenKeys={openSubMenuItems}
            style={{ height: '100%' }}
            inlineIndent={14}
            forceSubMenuRender
          >
            <Menu.SubMenu key='label' title='Slide label'>
              <Menu.Item style={{ height: '100%' }}>
                <div
                  style={{ height: '220px' }}
                  ref={this.labelViewportRef}
                />
              </Menu.Item>
            </Menu.SubMenu>
            {specimenMenu}
            {opticalPathMenu}
            <Menu.SubMenu key='annotations' title='Annotations'>
              {annotationMenuItems}
            </Menu.SubMenu>
            {annotationGroupMenu}
            {segmentationMenu}
            {parametricMapMenu}
          </Menu>
        </Layout.Sider>
      </Layout>
    )
  }
}

export default withRouter(SlideViewer)
