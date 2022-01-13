import React from 'react'
import {
  RouteComponentProps,
  withRouter
} from 'react-router-dom'
import {
  FaDrawPolygon,
  FaEye,
  FaHandPaper,
  FaHandPointer,
  FaRuler,
  FaTrash,
  FaSave
} from 'react-icons/fa'
import {
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
  slides: Slide[]
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
  activeSlide: Slide
  annotatedRoi?: dmv.roi.ROI
  selectedRoiUIDs: string[]
  visibleRoiUIDs: string[]
  visibleSegmentUIDs: string[]
  visibleMappingUIDs: string[]
  visibleAnnotationGroupUIDs: string[]
  visibleOpticalPathIdentifiers: string[]
  activeOpticalPathIdentifiers: string[]
  selectedFinding?: dcmjs.sr.coding.CodedConcept
  selectedEvaluations: Evaluation[]
  generatedReport?: dmv.metadata.Comprehensive3DSR
  isLoading: boolean
  isAnnotationModalVisible: boolean
  isReportModalVisible: boolean
}

/**
 * React component for interactive viewing of an individual digital slide,
 * which corresponds to one DICOM Series of DICOM Slide Microscopy images and
 * potentially one or more associated DICOM Series of DICOM SR documents.
 */
class SlideViewer extends React.Component<SlideViewerProps, SlideViewerState> {
  private readonly findingOptions: dcmjs.sr.coding.CodedConcept[] = []

  private readonly evaluationOptions: { [key: string]: EvaluationOptions[] } = {}

  private readonly volumeViewport = React.createRef<HTMLDivElement>()

  private readonly labelViewport = React.createRef<HTMLDivElement>()

  private volumeViewer?: dmv.viewer.VolumeImageViewer

  private labelViewer?: dmv.viewer.LabelImageViewer

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
      this.roiStyles[key] = annotation.style
    })

    this.volumeViewer = undefined
    this.labelViewer = undefined
    this.handleRoiDrawing = this.handleRoiDrawing.bind(this)
    this.handleRoiTranslation = this.handleRoiTranslation.bind(this)
    this.handleRoiModification = this.handleRoiModification.bind(this)
    this.handleRoiVisibilityChange = this.handleRoiVisibilityChange.bind(this)
    this.handleRoiRemoval = this.handleRoiRemoval.bind(this)
    this.handleAnnotationCompletion = this.handleAnnotationCompletion.bind(this)
    this.handleAnnotationCancellation = this.handleAnnotationCancellation.bind(this)
    this.handleAnnotationFindingSelection = this.handleAnnotationFindingSelection.bind(this)
    this.handleAnnotationEvaluationSelection = this.handleAnnotationEvaluationSelection.bind(this)
    this.handleAnnotationEvaluationClearance = this.handleAnnotationEvaluationClearance.bind(this)
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

    const slides = this.props.slides.filter(item => {
      const slideIndex = item.seriesInstanceUIDs.findIndex((uid) => {
        return uid === this.props.seriesInstanceUID
      })
      if (slideIndex !== -1) {
        return true
      }
      return false
    })

    if (slides.length === 0) {
      throw new Error(
        'No matching slide was found for selected series ' +
        `"${this.props.seriesInstanceUID}"`
      )
    }

    this.state = {
      isLoading: false,
      activeSlide: slides[0],
      isAnnotationModalVisible: false,
      annotatedRoi: undefined,
      selectedRoiUIDs: [],
      visibleRoiUIDs: [],
      visibleSegmentUIDs: [],
      visibleMappingUIDs: [],
      visibleAnnotationGroupUIDs: [],
      visibleOpticalPathIdentifiers: [],
      activeOpticalPathIdentifiers: [],
      selectedFinding: undefined,
      selectedEvaluations: [],
      isReportModalVisible: false,
      generatedReport: undefined
    }
  }

  componentDidUpdate (previousProps: SlideViewerProps): void {
    /** Fetch data and update the viewports if the route has changed,
     * i.e., if another series has been selected.
     */
    if (this.props.location !== previousProps.location ||
      this.props.slides !== previousProps.slides) {
      console.log(
        'switch viewports from series ' +
        previousProps.seriesInstanceUID +
        ' to series' +
        this.props.seriesInstanceUID
      )
      this.populateViewports()
    }
  }

  /**
   * Retrieve Structured Report instances that contain regions of interests
   * with 3D spatial coordinates defined in the same frame of reference as the
   * currently selected series and add them to the VOLUME image viewer.
   */
  addAnnotations = (): void => {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }

    console.info('search for Comprehensive 3D SR instances')
    this.props.client.searchForInstances({
      studyInstanceUID: this.props.studyInstanceUID,
      queryParams: {
        Modality: 'SR'
      }
    }).then((matchedInstances): void => {
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
              const slide = this.state.activeSlide
              const image = slide.volumeImages[0]
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
                const doesROIExist = viewer.getAllROIs().some(
                  (otherROI: dmv.roi.ROI): boolean => {
                    return _areROIsEqual(otherROI, roi)
                  }
                )
                if (!doesROIExist) {
                  try {
                    // Add ROI without style such that it won't be visible.
                    viewer.addROI(roi, {})
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
            // State update will also ensure that the component is re-rendered.
          }).catch((error) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            message.error('An error occured. Annotations could not be loaded')
            console.error(error)
          })
        }
      })
    }).catch((error) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.error('An error occured. Annotations could not be loaded')
      console.error(error)
    })
  }

  /**
   * Retrieve Microscopy Bulk Simple Annotations instances that contain
   * annotation groups defined in the same frame of reference as the currently
   * selected series and add them to the VOLUME image viewer.
   */
  addAnnotationGroups = (): void => {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
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
          retrievedMetadata.forEach(metadata => {
            const { dataset, bulkDataMapping }  = dmv.metadata.formatMetadata(
              metadata
            )
            const annotation = new dmv.metadata.MicroscopyBulkSimpleAnnotations({
                metadata: dataset
            })
            try {
              viewer.addAnnotationGroups(annotation, bulkDataMapping)
            } catch (error) {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              message.error(
                'An error occured. ' +
                'Microscopy Bulk Simple Annotations cannot be displayed.'
              )
              console.error(`failed to add annotation groups: ${error}`)
            }
          })
          this.forceUpdate()
        })
      })
    })
  }

  /**
   * Retrieve Segmentation instances that contain segments defined in the same
   * frame of reference as the currently selected series and add them to the
   * VOLUME image viewer.
   */
  addSegmentations = (): void => {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }

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
          let segmentations: dmv.metadata.Segmentation[] = retrievedMetadata.map(
            metadata => new dmv.metadata.Segmentation({ metadata })
          )
          segmentations = segmentations.filter(seg => {
            const refImage = this.state.activeSlide.volumeImages[0]
            return (
              seg.FrameOfReferenceUID === refImage.FrameOfReferenceUID &&
              seg.ContainerIdentifier === refImage.ContainerIdentifier
            )
          })
          if (segmentations.length > 0) {
            try {
              viewer.addSegments(segmentations)
            } catch (error) {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              message.error(
                'An error occured. ' +
                'Segmentations cannot be displayed.'
              )
              console.error(`failed to add segments: ${error}`)
            }
            this.forceUpdate()
          }
        })
      })
    })
  }

  /**
   * Retrieve Parametric Map instances that contain mappings defined in the same
   * frame of reference as the currently selected series and add them to the
   * VOLUME image viewer.
   */
  addParametricMaps = (): void => {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }

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
          let maps: dmv.metadata.ParametricMap[] = retrievedMetadata.map(
            metadata => new dmv.metadata.ParametricMap({ metadata })
          )
          maps = maps.filter(seg => {
            const refImage = this.state.activeSlide.volumeImages[0]
            return (
              seg.FrameOfReferenceUID === refImage.FrameOfReferenceUID &&
              seg.ContainerIdentifier === refImage.ContainerIdentifier
            )
          })
          if (maps.length > 0) {
            try {
              viewer.addMappings(maps)
            } catch (error) {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              message.error(
                'An error occured. ' +
                'Parametric Map cannot be displayed.'
              )
              console.error(`failed to add mappings: ${error}`)
            }
            this.forceUpdate()
          }
        })
      })
    })
  }

  /**
   * Retrieve metadata for image instances in the currently selected series and
   * instantiate the VOLUME and LABEL image viewers.
   */
  populateViewports = (): void => {
    const slideArray = this.props.slides
    const slides = slideArray.filter(item => {
      const slideIndex = item.seriesInstanceUIDs.findIndex((uid) => {
        return uid === this.props.seriesInstanceUID
      })
      if (slideIndex !== -1) {
        return true
      }
      return false
    })

    if (slides.length !== 0) {
      const slide = slides[0]
      this.setState({
        activeSlide: slide,
        isLoading: true
      })

      if (this.volumeViewport.current !== null) {
        console.info(
          'instantiate viewer for VOLUME images of series ' +
          this.props.seriesInstanceUID
        )
        this.volumeViewport.current.innerHTML = ''

        if (slide.areVolumeImagesMonochrome) {
          const volumeViewer = new dmv.viewer.VolumeImageViewer({
            client: this.props.client,
            metadata: slide.volumeImages
          })
          const activeOpticalPathIdentifiers: string[] = []
          const visibleOpticalPathIdentifiers: string[] = []
          volumeViewer.getAllOpticalPaths().forEach(opticalPath => {
            const identifier = opticalPath.identifier
            if (volumeViewer.isOpticalPathVisible(identifier)) {
              visibleOpticalPathIdentifiers.push(identifier)
            }
            if (volumeViewer.isOpticalPathActive(identifier)) {
              activeOpticalPathIdentifiers.push(identifier)
            }
          })
          this.setState({
            activeOpticalPathIdentifiers: activeOpticalPathIdentifiers,
            visibleOpticalPathIdentifiers: visibleOpticalPathIdentifiers
          })
          this.volumeViewer = volumeViewer
        } else {
          this.volumeViewer = new dmv.viewer.VolumeImageViewer({
            client: this.props.client,
            metadata: slide.volumeImages
          })
        }

        this.volumeViewer.render({ container: this.volumeViewport.current })
        this.volumeViewer.activateSelectInteraction({})
        this.volumeViewer.toggleOverviewMap()
      }

      if (slide.labelImages.length > 0) {
        if (this.labelViewport.current !== null) {
          this.labelViewport.current.innerHTML = ''
          console.info(
            'instantiate viewer for LABEL image of series ' +
            this.props.seriesInstanceUID
          )
          this.labelViewer = new dmv.viewer.LabelImageViewer({
            client: this.props.client,
            metadata: slide.labelImages[0],
            resizeFactor: 1,
            orientation: 'vertical'
          })
          this.labelViewer.render({
            container: this.labelViewport.current
          })
        }
      }
    }

    // State update will also ensure that the component is re-rendered.
    this.setState({ isLoading: false })

    this.addAnnotations()
    this.addAnnotationGroups()
    this.addSegmentations()
    this.addParametricMaps()
  }

  onRoiDrawn = (event: CustomEventInit): void => {
    const roi = event.detail.payload as dmv.roi.ROI
    console.debug(`added ROI "${roi.uid}"`)
    this.setState({
      isAnnotationModalVisible: true,
      annotatedRoi: roi
    })
    if (this.volumeViewer !== undefined) {
      if (this.volumeViewer.isDrawInteractionActive) {
        console.info('deactivate drawing of ROIs')
        this.volumeViewer.deactivateDrawInteraction()
        this.volumeViewer.activateSelectInteraction({})
      }
    }
  }

  onRoiSelected = (event: CustomEventInit): void => {
    const selectedRoi = event.detail.payload as dmv.roi.ROI
    if (this.volumeViewer !== undefined) {
      if (selectedRoi !== null) {
        console.debug(`selected ROI "${selectedRoi.uid}"`)
        const viewer = this.volumeViewer
        if (viewer !== undefined) {
          viewer.setROIStyle(selectedRoi.uid, this.selectedRoiStyle)
          const key = _getRoiKey(selectedRoi)
          viewer.getAllROIs().forEach((roi) => {
            if (roi.uid !== selectedRoi.uid) {
              viewer.setROIStyle(roi.uid, this.roiStyles[key])
            }
          })
        }
        this.setState({
          selectedRoiUIDs: [...this.state.selectedRoiUIDs, selectedRoi.uid]
        })
      } else {
        this.setState({ selectedRoiUIDs: [] })
      }
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

  componentWillUnmount (): void {
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
      'dicommicroscopyviewer_loading_started',
      this.onLoadingStarted
    )
    document.body.removeEventListener(
      'dicommicroscopyviewer_loading_ended',
      this.onLoadingEnded
    )
  }

  componentDidMount (): void {
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
      'dicommicroscopyviewer_loading_started',
      this.onLoadingStarted
    )
    document.body.addEventListener(
      'dicommicroscopyviewer_loading_ended',
      this.onLoadingEnded
    )
    this.populateViewports()
  }

  /**
   * Handler that gets called when a finding has been selected for an
   * annotation after the region of interest has been drawn.
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
   * Handler that gets called when an evaluation has been selected for an
   * annotation after the region of interest has been drawn.
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
   * annotation after the region of interest has been drawn.
   */
  handleAnnotationEvaluationClearance (): void {
    this.setState({
      selectedEvaluations: []
    })
  }

  /**
   * Handler that gets called when an annotation has been completed.
   */
  handleAnnotationCompletion (): void {
    const viewer = this.volumeViewer
    const roi = this.state.annotatedRoi
    const selectedFinding = this.state.selectedFinding
    const selectedEvaluations = this.state.selectedEvaluations
    if (
      roi !== undefined &&
      selectedFinding !== undefined &&
      viewer !== undefined
    ) {
      console.info(`completed annotation of ROI "${roi.uid}"`)
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
      viewer.addROIEvaluation(roi.uid, findingItem)
      selectedEvaluations.forEach((evaluation: Evaluation) => {
        const item = new dcmjs.sr.valueTypes.CodeContentItem({
          name: evaluation.name,
          value: evaluation.value,
          relationshipType: 'CONTAINS'
        })
        roi.addEvaluation(item)
        viewer.addROIEvaluation(roi.uid, item)
      })
      this.setState(state => ({
        annotatedRoi: roi,
        visibleRoiUIDs: [...state.visibleRoiUIDs, roi.uid]
      }))
      const key = _buildKey(selectedFinding)
      var style = this.roiStyles[key]
      viewer.setROIStyle(roi.uid, style)
    }
    this.setState({ isAnnotationModalVisible: false })
  }

  /**
   * Handler that gets called when an annotation has been cancelled.
   */
  handleAnnotationCancellation (): void {
    console.info('cancel annotation')
    const roi = this.state.annotatedRoi
    if (this.volumeViewer !== undefined && roi !== undefined) {
      this.volumeViewer.removeROI(roi.uid)
    }
    this.setState({
      isAnnotationModalVisible: false,
      annotatedRoi: undefined
    })
  }

  /**
   * Handler that gets called when a report should be generated for the current
   * set of annotations.
   */
  handleReportGeneration (): void {
    if (this.volumeViewer === undefined) {
      return
    }
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
        (response: void) => message.info('Annotations were saved.')
      ).catch((error) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error('An error occured. Annotations were not saved.')
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
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.log(`selected ROI ${roiUID}`)
    this.setState({ selectedRoiUIDs: [roiUID] })
    viewer.getAllROIs().forEach((roi) => {
      var style = {}
      if (roi.uid === roiUID) {
        style = this.selectedRoiStyle
        this.setState(state => ({
          visibleRoiUIDs: [...state.visibleRoiUIDs, roiUID]
        }))
      } else {
        if (this.state.visibleRoiUIDs.includes(roi.uid as never)) {
          const key = _getRoiKey(roi)
          style = this.roiStyles[key]
        }
      }
      viewer.setROIStyle(roi.uid, style)
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
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    if (isVisible) {
      console.info(`show ROI ${roiUID}`)
      const roi = viewer.getROI(roiUID)
      const key = _getRoiKey(roi)
      viewer.setROIStyle(roi.uid, this.roiStyles[key])
      this.setState(state => ({
        visibleRoiUIDs: [...state.visibleRoiUIDs, roiUID]
      }))
    } else {
      console.info(`hide ROI ${roiUID}`)
      this.setState(state => ({
        visibleRoiUIDs: state.visibleRoiUIDs.filter(uid => uid !== roiUID),
        selectedRoiUIDs: state.selectedRoiUIDs.filter(uid => uid !== roiUID)
      }))
      viewer.setROIStyle(roiUID, {})
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
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.log(`change visibility of annotation group ${annotationGroupUID}`)
    if (isVisible) {
      console.info(`show annotation group ${annotationGroupUID}`)
      viewer.showAnnotationGroup(annotationGroupUID)
      this.setState(state => ({
        visibleAnnotationGroupUIDs: state.visibleAnnotationGroupUIDs.concat(
          annotationGroupUID
        )
      }))
    } else {
      console.info(`hide annotation group ${annotationGroupUID}`)
      viewer.hideAnnotationGroup(annotationGroupUID)
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
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.log(`change style of annotation group ${annotationGroupUID}`)
    viewer.setAnnotationGroupStyle(annotationGroupUID, styleOptions)
  }

  /**
   * Handle toggling of segment visibility, i.e., whether a given
   * segment should be either displayed or hidden by the viewer.
   */
  handleSegmentVisibilityChange ({ segmentUID, isVisible }: {
    segmentUID: string
    isVisible: boolean
  }): void {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.log(`change visibility of segment ${segmentUID}`)
    if (isVisible) {
      console.info(`show segment ${segmentUID}`)
      viewer.showSegment(segmentUID)
      this.setState(state => ({
        visibleSegmentUIDs: state.visibleSegmentUIDs.concat(segmentUID)
      }))
    } else {
      console.info(`hide segment ${segmentUID}`)
      viewer.hideSegment(segmentUID)
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
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.log(`change style of segment ${segmentUID}`)
    viewer.setSegmentStyle(segmentUID, styleOptions)
  }

  /**
   * Handle toggling of mapping visibility, i.e., whether a given
   * mapping should be either displayed or hidden by the viewer.
   */
  handleMappingVisibilityChange ({ mappingUID, isVisible }: {
    mappingUID: string
    isVisible: boolean
  }): void {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.log(`change visibility of mapping ${mappingUID}`)
    if (isVisible) {
      console.info(`show mapping ${mappingUID}`)
      viewer.showMapping(mappingUID)
      this.setState(state => ({
        visibleMappingUIDs: state.visibleMappingUIDs.concat(mappingUID)
      }))
    } else {
      console.info(`hide mapping ${mappingUID}`)
      viewer.hideMapping(mappingUID)
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
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.log(`change style of mapping ${mappingUID}`)
    viewer.setMappingStyle(mappingUID, styleOptions)
  }

  /**
   * Handle toggling of optical path visibility, i.e., whether a given
   * optical path should be either displayed or hidden by the viewer.
   */
  handleOpticalPathVisibilityChange ({ opticalPathIdentifier, isVisible }: {
    opticalPathIdentifier: string,
    isVisible: boolean
  }): void {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.log(`change visibility of optical path ${opticalPathIdentifier}`)
    if (isVisible) {
      console.info(`show optical path ${opticalPathIdentifier}`)
      viewer.showOpticalPath(opticalPathIdentifier)
      this.setState(state => ({
        visibleOpticalPathIdentifiers:
          state.visibleOpticalPathIdentifiers.concat(opticalPathIdentifier)
      }))
    } else {
      console.info(`hide optical path ${opticalPathIdentifier}`)
      viewer.hideOpticalPath(opticalPathIdentifier)
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
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.log(`change style of optical path ${opticalPathIdentifier}`)
    viewer.setOpticalPathStyle(opticalPathIdentifier, styleOptions)
  }

  /**
   * Handle toggling of optical path activity, i.e., whether a given
   * optical path should be either added or removed from the viewport.
   */
  handleOpticalPathActivityChange ({ opticalPathIdentifier, isActive }: {
    opticalPathIdentifier: string,
    isActive: boolean
  }): void {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.log(`change activity of optical path ${opticalPathIdentifier}`)
    if (isActive) {
      console.info(`activate optical path ${opticalPathIdentifier}`)
      viewer.activateOpticalPath(opticalPathIdentifier)
      this.setState(state => ({
        activeOpticalPathIdentifiers:
          state.activeOpticalPathIdentifiers.concat(opticalPathIdentifier)
      }))
    } else {
      console.info(`deactivate optical path ${opticalPathIdentifier}`)
      viewer.deactivateOpticalPath(opticalPathIdentifier)
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
  handleRoiDrawing ({ geometryType, markup }: {
    geometryType: string
    markup?: string
  }): void {
    if (this.volumeViewer === undefined) {
      return
    }
    if (this.volumeViewer.isDrawInteractionActive) {
      console.info('deactivate drawing of ROIs')
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.activateSelectInteraction({})
    } else {
      console.info(`activate drawing of ROIs for geometry Type ${geometryType}`)
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.deactivateSnapInteraction()
      this.volumeViewer.deactivateTranslateInteraction()
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.activateDrawInteraction({ geometryType, markup })
    }
  }

  /**
   * Handler that will toggle the ROI modification tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiModification (): void {
    if (this.volumeViewer === undefined) {
      return
    }
    console.info('toggle modification of ROIs')
    if (this.volumeViewer.isModifyInteractionActive) {
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.deactivateSnapInteraction()
      this.volumeViewer.activateSelectInteraction({})
    } else {
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
    if (this.volumeViewer === undefined) {
      return
    }
    console.info('toggle translation of ROIs')
    if (this.volumeViewer.isTranslateInteractionActive) {
      this.volumeViewer.deactivateTranslateInteraction()
    } else {
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
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    this.state.selectedRoiUIDs.forEach(uid => {
      if (uid === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.warning('No annotation was selected for removal')
        return
      }
      console.info('remove ROI "{uid}"')
      viewer.removeROI(uid)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.info('Annotation was removed')
    })
    this.setState({ selectedRoiUIDs: [] })
  }

  /**
   * Handler that will toggle the ROI visibility tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiVisibilityChange (): void {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.info('toggle visibility of ROIs')
    if (viewer.areROIsVisible) {
      viewer.deactivateDrawInteraction()
      viewer.deactivateSnapInteraction()
      viewer.deactivateTranslateInteraction()
      viewer.deactivateSelectInteraction()
      viewer.deactivateModifyInteraction()
      viewer.hideROIs()
    } else {
      viewer.showROIs()
      viewer.activateSelectInteraction({})
      this.state.selectedRoiUIDs.forEach(uid => {
        if (uid !== undefined) {
          viewer.setROIStyle(uid, this.selectedRoiStyle)
        }
      })
    }
  }

  render (): React.ReactNode {
    const rois: dmv.roi.ROI[] = []
    const segments: dmv.segment.Segment[] = []
    const mappings: dmv.mapping.Mapping[] = []
    const annotationGroups: dmv.annotation.AnnotationGroup[] = []
    if (this.volumeViewer !== undefined) {
      rois.push(...this.volumeViewer.getAllROIs())
      segments.push(...this.volumeViewer.getAllSegments())
      mappings.push(...this.volumeViewer.getAllMappings())
      annotationGroups.push(...this.volumeViewer.getAllAnnotationGroups())
    }

    const openSubMenuItems = ['specimens', 'annotations']

    const handlePolygonRoiDrawing = (): void => {
      this.handleRoiDrawing({ geometryType: 'freehandpolygon' })
    }

    const handleLineRoiDrawing = (): void => {
      this.handleRoiDrawing({ geometryType: 'line', markup: 'measurement' })
    }

    let report: React.ReactNode
    const dataset = this.state.generatedReport
    if (dataset !== undefined) {
      report = <Report dataset={dataset} />
    }

    let annotationMenu: React.ReactNode
    if (rois.length > 0) {
      annotationMenu = (
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
    const selections: React.ReactNode[] = [
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
              allowClear={true}
              onClear={this.handleAnnotationEvaluationClearance}
              defaultActiveFirstOption={false}
            >
              {evaluationOptions}
            </Select>
          </>
        )
      })
    }

    let specimenMenu
    let opticalPathMenu
    const slide = this.state.activeSlide
    if (slide.areVolumeImagesMonochrome) {
      openSubMenuItems.push('opticalpaths')
      specimenMenu = (
        <Menu.SubMenu key='specimens' title='Specimens'>
          <SpecimenList
            metadata={slide.volumeImages[0]}
            showstain={false}
          />
        </Menu.SubMenu>
      )
      if (this.volumeViewer !== undefined) {
        const viewer = this.volumeViewer as dmv.viewer.VolumeImageViewer
        const defaultOpticalPathStyles: {
          [opticalPathIdentifier: string]: {
            opacity: number
            color: number[]
            limitValues: number[]
          }
        } = {}
        const opticalPathMetadata: {
          [opticalPathIdentifier: string]: dmv.metadata.VLWholeSlideMicroscopyImage[]
        } = {}
        const opticalPaths = viewer.getAllOpticalPaths()
        opticalPaths.forEach(opticalPath => {
          const identifier = opticalPath.identifier
          const style = viewer.getOpticalPathStyle(identifier)
          defaultOpticalPathStyles[identifier] = style
          opticalPathMetadata[identifier] = viewer.getOpticalPathMetadata(
            identifier
          )
        })
        opticalPathMenu = (
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
      }
    } else {
      specimenMenu = (
        <Menu.SubMenu key='specimens' title='Specimens'>
          <SpecimenList
            metadata={slide.volumeImages[0]}
            showstain
          />
        </Menu.SubMenu>
      )
    }

    let segmentationMenu
    if (segments.length > 0) {
      const defaultSegmentStyles: {
        [segmentUID: string]: {
          opacity: number
        }
      } = {}
      const viewer = this.volumeViewer as dmv.viewer.VolumeImageViewer
      const segmentMetadata: {
        [segmentUID: string]: dmv.metadata.Segmentation[]
      } = {}
      const segments = viewer.getAllSegments()
      segments.forEach(segment => {
        defaultSegmentStyles[segment.uid] = viewer.getSegmentStyle(segment.uid)
        segmentMetadata[segment.uid] = viewer.getSegmentMetadata(
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
          limitValues: number[]
        }
      } = {}
      const mappingMetadata: {
        [mappingUID: string]: dmv.metadata.ParametricMap[]
      } = {}
      const viewer = this.volumeViewer as dmv.viewer.VolumeImageViewer
      mappings.forEach(mapping => {
        defaultMappingStyles[mapping.uid] = viewer.getMappingStyle(mapping.uid)
        mappingMetadata[mapping.uid] = viewer.getMappingMetadata(
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
      const viewer = this.volumeViewer as dmv.viewer.VolumeImageViewer
      const annotationGroupMetadata: {
        [annotationGroupUID: string]: dmv.metadata.MicroscopyBulkSimpleAnnotations[]
      } = {}
      const annotationGroups = viewer.getAllAnnotationGroups()
      annotationGroups.forEach(annotationGroup => {
        defaultAnnotationGroupStyles[annotationGroup.uid] = viewer.getAnnotationGroupStyle(annotationGroup.uid)
        annotationGroupMetadata[annotationGroup.uid] = viewer.getAnnotationGroupMetadata(
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
            isToggle
            tooltip='Draw ROI'
            icon={FaDrawPolygon}
            onClick={handlePolygonRoiDrawing}
          />
          <Button
            isToggle
            tooltip='Measure'
            icon={FaRuler}
            onClick={handleLineRoiDrawing}
          />
          <Button
            isToggle
            tooltip='Modify ROIs'
            icon={FaHandPointer}
            onClick={this.handleRoiModification}
          />
          <Button
            isToggle
            tooltip='Shift ROIs'
            icon={FaHandPaper}
            onClick={this.handleRoiTranslation}
          />
          <Button
            tooltip='Remove selected ROI'
            onClick={this.handleRoiRemoval}
            icon={FaTrash}
          />
          <Button
            isToggle
            tooltip='Show/Hide ROIs'
            icon={FaEye}
            onClick={this.handleRoiVisibilityChange}
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
    let loadingDisplay = "none"
    if (this.state.isLoading) {
      loadingDisplay = "block"
    }

    return (
      <Layout style={{ height: '100%' }} hasSider>
        <Layout.Content style={{ height: '100%' }}>
          {toolbar}

          <div className="dimmer" style={{ display: loadingDisplay }} />
          <div className="spinner" style={{ display: loadingDisplay }} />
          <div
            style={{ height: `calc(100% - ${toolbarHeight})` }}
            ref={this.volumeViewport}
          />

          <Modal
            visible={this.state.isAnnotationModalVisible}
            title='Select finding'
            onOk={this.handleAnnotationCompletion}
            onCancel={this.handleAnnotationCancellation}
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
          theme='light'
          reverseArrow style={{
            borderLeft: 'solid',
            borderLeftWidth: 0.25
          }}
        >
          <Menu
            mode='inline'
            defaultOpenKeys={openSubMenuItems}
            style={{ height: '100%' }}
            inlineIndent={14}
            theme='light'
            forceSubMenuRender
          >
            <Menu.SubMenu key='label' title='Slide label'>
              <Menu.Item style={{ height: '100%' }}>
                <div style={{ height: '220px' }} ref={this.labelViewport} />
              </Menu.Item>
            </Menu.SubMenu>
            {specimenMenu}
            {opticalPathMenu}
            <Menu.SubMenu key='annotations' title='Annotations'>
              {annotationMenu}
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
