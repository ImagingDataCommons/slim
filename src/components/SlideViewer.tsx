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
import Button from './Button'
import Report, { MeasurementReport } from './Report'
import SpecimenList from './SpecimenList'
import SamplesList from './SamplesList'
import { AnnotationSettings, RendererSettings } from '../AppConfig'
import { findContentItemsByName } from '../utils/sr'
import { Slide } from '../data/slides'

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
  renderer: RendererSettings
  annotations: AnnotationSettings[]
  user?: {
    name: string
    email: string
  }
}

interface SlideViewerState {
  activeSlide?: Slide
  annotatedRoi?: dmv.roi.ROI
  selectedRoiUIDs: string[]
  visibleRoiUIDs: string[]
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
  state = {
    isLoading: false,
    activeSlide: undefined,
    isAnnotationModalVisible: false,
    annotatedRoi: undefined,
    selectedRoiUIDs: [],
    visibleRoiUIDs: [],
    selectedFinding: undefined,
    selectedEvaluations: [],
    isReportModalVisible: false,
    generatedReport: undefined
  }

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
    this.handleRoiVisibility = this.handleRoiVisibility.bind(this)
    this.handleAnnotationVisibility = this.handleAnnotationVisibility.bind(this)
    this.handleRoiRemoval = this.handleRoiRemoval.bind(this)
    this.handleAnnotationSelection = this.handleAnnotationSelection.bind(this)
    this.handleReportGeneration = this.handleReportGeneration.bind(this)
    this.handleAnnotationFindingSelection = this.handleAnnotationFindingSelection.bind(this)
    this.handleAnnotationEvaluationSelection = this.handleAnnotationEvaluationSelection.bind(this)
    this.handleAnnotationCompletion = this.handleAnnotationCompletion.bind(this)
    this.handleAnnotationCancellation = this.handleAnnotationCancellation.bind(this)
    this.handleReportVerification = this.handleReportVerification.bind(this)
    this.handleReportCancellation = this.handleReportCancellation.bind(this)

    const slideArray = this.props.slides
    const slides = slideArray.filter(item => {
      const slideItem = item
      if (slideItem.seriesInstanceUIDs.findIndex(uid => uid === this.props.seriesInstanceUID) !== -1) {
        return true
      }
      return false
    })

    if (slides.length !== 0) {
      const slide = slides[0]
      this.setState(state => ({
        activeSlide: slide
      }))
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
   * Retrieve structured report instances that contain regions of interests
   * with 3D spatial coordinates defined in the same frame of reference as the
   * currently selected series and adds them to the VOLUME image viewer.
   */
  addAnnotations = (): void => {
    console.info('search for Comprehensive 3D SR instances')
    this.setState(state => ({ isLoading: true }))
    this.props.client.searchForInstances({
      studyInstanceUID: this.props.studyInstanceUID,
      queryParams: {
        Modality: 'SR'
      }
    }).then((matchedInstances): void => {
      matchedInstances.forEach(i => {
        const instance = dmv.metadata.formatMetadata(i) as dmv.metadata.Instance
        if (instance.SOPClassUID === '1.2.840.10008.5.1.4.1.1.88.34') {
          console.info(`retrieve SR instance "${instance.SOPInstanceUID}"`)
          this.props.client.retrieveInstance({
            studyInstanceUID: instance.StudyInstanceUID ?? this.props.studyInstanceUID,
            seriesInstanceUID: instance.SeriesInstanceUID,
            sopInstanceUID: instance.SOPInstanceUID
          }).then((retrievedInstance): void => {
            const data = dcmjs.data.DicomMessage.readFile(retrievedInstance)
            const dataset = dmv.metadata.formatMetadata(data.dict)
            const report = dataset as unknown as dmv.metadata.Comprehensive3DSR
            const content = new MeasurementReport(report)
            content.ROIs.forEach(roi => {
              console.info(`add ROI "${roi.uid}"`)
              const scoord3d = roi.scoord3d
              const activeSlide = this.state.activeSlide
              if (activeSlide !== undefined) {
                const slide = activeSlide as Slide
                const image = slide.firstFormattedVolumeInstance
                if (scoord3d.frameOfReferenceUID === image.FrameOfReferenceUID) {
                  if (this.volumeViewer !== undefined) {
                    /**
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
                    }
                  } else {
                    console.error(
                      `could not add ROI "${roi.uid}" ` +
                      'because viewer has not yet been instantiated'
                    )
                  }
                }
              }
            })
            // State update will also ensure that the component is re-rendered.
            this.setState(state => ({ isLoading: false }))
          }).catch((error) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            message.error('An error occured. Annotation could not be loaded')
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
   * Retrieve metadata for image instances in the currently selected series and
   * instantiate the VOLUME and LABEL image viewers.
   */
  populateViewports = (): void => {
    const slideArray = this.props.slides
    const slides = slideArray.filter(item => {
      const slideItem = item
      if (slideItem.slideOptions.seriesInstanceUIDs.findIndex(uid => uid === this.props.seriesInstanceUID) !== -1) {
        return true
      }
      return false
    })

    if (slides.length !== 0) {
      const slide = slides[0]
      this.setState(state => ({
        activeSlide: slide,
        isLoading: true
      }))

      if (this.volumeViewport.current !== null) {
        console.info(
          'instantiate viewer for VOLUME images of series ' +
          this.props.seriesInstanceUID
        )
        this.volumeViewport.current.innerHTML = ''

        if (slide.areImagesMonochrome() &&
          slide.selectedOpticalPathidentifier !== undefined
        ) {
          const blendInfo: dmv.channel.BlendingInformation = {
            opticalPathIdentifier: slide.selectedOpticalPathidentifier,
            color: [0, 0.9, 0.9],
            opacity: 1.0,
            thresholdValues: [0, 255],
            limitValues: [0, 255],
            visible: true
          }

          this.volumeViewer = new dmv.viewer.VolumeImageViewer({
            client: this.props.client,
            metadata: slide.volumeInstances,
            blendingInformation: [blendInfo],
            retrieveRendered: this.props.renderer.retrieveRendered
          })
        } else {
          this.volumeViewer = new dmv.viewer.VolumeImageViewer({
            client: this.props.client,
            metadata: slide.volumeInstances,
            retrieveRendered: this.props.renderer.retrieveRendered
          })
        }

        this.volumeViewer.render({ container: this.volumeViewport.current })
        this.volumeViewer.activateSelectInteraction({})
        this.volumeViewer.toggleOverviewMap()
      }

      if (this.labelViewport.current !== null) {
        this.labelViewport.current.innerHTML = ''
        if (slide.labelInstances.length > 0) {
          console.info(
            'instantiate viewer for LABEL image of series ' +
            this.props.seriesInstanceUID
          )
          this.labelViewer = new dmv.viewer.LabelImageViewer({
            client: this.props.client,
            metadata: slide.labelInstances[0],
            resizeFactor: 1,
            orientation: 'vertical'
          })
          this.labelViewer.render({ container: this.labelViewport.current })
        }
      }
    }

    // State update will also ensure that the component is re-rendered.
    this.setState(state => ({ isLoading: false }))

    this.addAnnotations()
  }

  onRoiDrawn = (event: CustomEventInit): void => {
    const roi = event.detail.payload as dmv.roi.ROI
    console.debug(`added ROI "${roi.uid}"`)
    this.setState(state => ({
      isAnnotationModalVisible: true,
      annotatedRoi: roi
    }))
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
        this.setState(state => ({
          selectedRoiUIDs: [...this.state.selectedRoiUIDs, selectedRoi.uid]
        }))
      } else {
        this.setState(state => ({
          selectedRoiUIDs: []
        }))
      }
    }
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
        this.setState(state => ({ selectedFinding: finding }))
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
              this.setState(state => ({
                selectedEvaluations: [
                  ...filteredEvaluations,
                  { name: name, value: code }
                ]
              }))
            }
          })
        }
      })
    }
  }

  /**
   * Handler that gets called when an annotation has been completed.
   */
  handleAnnotationCompletion (): void {
    const viewer = this.volumeViewer
    const annotatedRoi = this.state.annotatedRoi
    const selectedFinding = this.state.selectedFinding
    const selectedEvaluations = this.state.selectedEvaluations
    if (
      annotatedRoi !== undefined &&
      selectedFinding !== undefined &&
      viewer !== undefined
    ) {
      const roi = annotatedRoi as dmv.roi.ROI
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
        visibleRoiUIDs: [...this.state.visibleRoiUIDs, roi.uid]
      }))
      const key = _buildKey(selectedFinding)
      var style = this.roiStyles[key]
      viewer.setROIStyle(roi.uid, style)
    }
    this.setState(state => ({ isAnnotationModalVisible: false }))
  }

  /**
   * Handler that gets called when an annotation has been cancelled.
   */
  handleAnnotationCancellation (): void {
    console.info('cancel annotation')
    const annotatedRoi = this.state.annotatedRoi
    if (this.volumeViewer !== undefined && annotatedRoi !== undefined) {
      const roi = annotatedRoi as dmv.roi.ROI
      this.volumeViewer.removeROI(roi.uid)
    }
    this.setState(state => ({
      isAnnotationModalVisible: false,
      annotatedRoi: undefined
    }))
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
    const metadata = this.volumeViewer.imageMetadata
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
        (property: dcmjs.sr.valueTypes.ContentItem) => {
          return property.ConceptNameCodeSequence[0].CodeValue === '121071'
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
        })
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
      seriesDescription: 'Whole slide image annotation',
      sopInstanceUID: dcmjs.data.DicomMetaDictionary.uid(),
      instanceNumber: 1,
      manufacturer: 'MGH Computational Pathology'
    })

    this.setState(state => ({
      isReportModalVisible: true,
      generatedReport: dataset as dmv.metadata.Comprehensive3DSR
    }))
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
        (response: string) => message.info('Annotations were saved.')
      ).catch((error) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error('An error occured. Annotations were not saved.')
        console.error(error)
      })
    }
    this.setState(state => ({
      isReportModalVisible: false,
      generatedReport: undefined
    }))
  }

  /**
   * Handler that gets called when report generation has been cancelled.
   */
  handleReportCancellation (): void {
    this.setState(state => ({
      isReportModalVisible: false,
      generatedReport: undefined
    }))
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
    this.setState(state => ({ selectedRoiUIDs: [roiUID] }))
    viewer.getAllROIs().forEach((roi) => {
      var style = {}
      if (roi.uid === roiUID) {
        style = this.selectedRoiStyle
        this.setState(state => ({
          visibleRoiUIDs: [...this.state.visibleRoiUIDs, roiUID]
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
  handleAnnotationVisibility ({ roiUID }: { roiUID: string }): void {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    if (this.state.visibleRoiUIDs.includes(roiUID as never)) {
      console.info(`hide ROI ${roiUID}`)
      this.setState(state => ({
        visibleRoiUIDs: this.state.visibleRoiUIDs.filter(uid => uid !== roiUID),
        selectedRoiUIDs: this.state.selectedRoiUIDs.filter(uid => uid !== roiUID)
      }))
      viewer.setROIStyle(roiUID, {})
    } else {
      console.info(`show ROI ${roiUID}`)
      const roi = viewer.getROI(roiUID)
      const key = _getRoiKey(roi)
      viewer.setROIStyle(roi.uid, this.roiStyles[key])
      this.setState(state => ({
        visibleRoiUIDs: [...this.state.visibleRoiUIDs, roiUID]
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
      this.volumeViewer.activateSelectInteraction({})
    } else {
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.deactivateTranslateInteraction()
      this.volumeViewer.deactivateSelectInteraction()
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
    this.setState(state => ({ selectedRoiUIDs: [] }))
  }

  /**
   * Handler that will toggle the ROI visibility tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiVisibility (): void {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    console.info('toggle visibility of ROIs')
    if (viewer.areROIsVisible) {
      viewer.deactivateDrawInteraction()
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
    if (this.volumeViewer !== undefined) {
      this.volumeViewer.resize()
      rois.push(...this.volumeViewer.getAllROIs())
    }
    if (this.labelViewer !== undefined) {
      this.labelViewer.resize()
    }

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

    let annotations: React.ReactNode
    if (rois.length > 0) {
      annotations = (
        <AnnotationList
          rois={rois}
          selectedRoiUIDs={this.state.selectedRoiUIDs}
          visibleRoiUIDs={this.state.visibleRoiUIDs}
          onSelection={this.handleAnnotationSelection}
          onToggleVisibility={this.handleAnnotationVisibility}
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
            >
              {evaluationOptions}
            </Select>
          </>
        )
      })
    }

    let specimenMenu
    let sampleMenu
    const activeSlide = this.state.activeSlide
    if (activeSlide !== undefined) {
      const slide = activeSlide as Slide
      if (!slide.isMultiplexedSamples()) {
        specimenMenu = (
          <Menu.SubMenu key='specimens' title='Specimens'>
            <SpecimenList
              metadata={slide.firstFormattedVolumeInstance}
              showstain
            />
          </Menu.SubMenu>
        )
      } else {
        specimenMenu = (
          <Menu.SubMenu key='specimens' title='Specimens'>
            <SpecimenList
              metadata={slide.firstFormattedVolumeInstance}
              showstain={false}
            />
          </Menu.SubMenu>
        )
        const volumeViewer = this.volumeViewer as dmv.viewer.VolumeImageViewer
        if (volumeViewer !== undefined) {
          sampleMenu = (
            <Menu.SubMenu key='samples' title='Samples'>
              <SamplesList
                metadata={slide.formattedVolumeInstances}
                viewer={volumeViewer}
              />
            </Menu.SubMenu>
          )
        }
      }
    }

    return (
      <Layout style={{ height: '100%' }} hasSider>
        <Layout.Content style={{ height: '100%' }}>
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
              onClick={this.handleRoiVisibility}
            />
            <Button
              tooltip='Save ROIs'
              icon={FaSave}
              onClick={this.handleReportGeneration}
            />
          </Row>
          <div style={{ height: 'calc(100% - 50px)' }} ref={this.volumeViewport} />

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
            defaultOpenKeys={['slideImage', 'annotations']}
            style={{ height: '100%' }}
            inlineIndent={14}
            theme='light'
          >
            <Menu.SubMenu key='slideImage' title='Slide label'>
              <div style={{ height: '220px' }} ref={this.labelViewport} />
            </Menu.SubMenu>
            {specimenMenu}
            {sampleMenu}
            <Menu.SubMenu key='annotations' title='Annotations'>
              {annotations}
            </Menu.SubMenu>
          </Menu>
        </Layout.Sider>
      </Layout>
    )
  }
}

export default withRouter(SlideViewer)
