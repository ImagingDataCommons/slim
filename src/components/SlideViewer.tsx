import React from 'react'
import {
  RouteComponentProps,
  withRouter
} from 'react-router-dom'
import {
  FaDrawPolygon,
  FaEye,
  FaHandPointer,
  FaTrash,
  FaSave
} from 'react-icons/fa'
import {
  Divider,
  Dropdown,
  Menu,
  message,
  Modal,
  Layout,
  Row,
  Select
} from 'antd'

import * as dmv from 'dicom-microscopy-viewer'
import * as dwc from 'dicomweb-client'
import * as dcmjs from 'dcmjs'

import AnnotationList from './AnnotationList'
import Button from './Button'
import Report, { MeasurementReport } from './Report'
import SpecimenList from './SpecimenList'
import { AnnotationSettings } from '../AppConfig'
import { findContentItemsByName } from '../utils/sr'


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
    throw Error(`No finding found for ROI ${roi.uid}`)
  }
  const finding = matches[0] as dcmjs.sr.valueTypes.CodeContentItem
  const findingName = finding.ConceptCodeSequence[0]
  return _buildKey(findingName)
}


interface SlideViewerProps extends RouteComponentProps {
  client: dwc.api.DICOMwebClient
  studyInstanceUID: string
  seriesInstanceUID: string
  app: {
    name: string
    version: string
    uid: string
  }
  annotations: AnnotationSettings[]
  user?: {
    name: string
    username: string
    email: string
  }
}

interface SlideViewerState {
  isLoading: boolean
  metadata: dmv.metadata.VLWholeSlideMicroscopyImage[]
  showAnnotationModal: boolean
  annotatedRoi?: dmv.roi.ROI
  selectedRoiUID?: string
  selectedFindingType?: dcmjs.sr.coding.CodedConcept
  showReportModal: boolean
  generatedReport?: dmv.metadata.Comprehensive3DSR
}

class SlideViewer extends React.Component<SlideViewerProps, SlideViewerState> {
  state = {
    isLoading: false,
    metadata: [],
    showAnnotationModal: false,
    annotatedRoi: undefined,
    selectedRoiUID: undefined,
    selectedFindingType: undefined,
    showReportModal: false,
    generatedReport: undefined
  }

  private readonly findingTypes: dcmjs.sr.coding.CodedConcept[] = []

  private readonly volumeViewport = React.createRef<HTMLDivElement>()

  private readonly labelViewport = React.createRef<HTMLDivElement>()

  private volumeViewer?: dmv.viewer.VolumeImageViewer

  private labelViewer?: dmv.viewer.LabelImageViewer

  private roiStyles: {[key: string]: dmv.viewer.ROIStyleOptions} = {}

  private selectionColor: number[] = [140, 184, 198]

  private selectedRoiStyle: {
    stroke?: { color: number[], width: number }
    fill?: { color: number[] }
  } = {
    stroke: { color: [...this.selectionColor, 1], width: 3 },
    fill: { color: [...this.selectionColor, 0.2] }
  }

  constructor (props: SlideViewerProps) {
    super(props)
    props.annotations.forEach((annotation: AnnotationSettings) => {
      const findingType = new dcmjs.sr.coding.CodedConcept(annotation.finding)
      this.findingTypes.push(findingType)
      const key = _buildKey(findingType)
      this.roiStyles[key] = annotation.style
    })

    this.volumeViewer = undefined
    this.labelViewer = undefined
    this.handleRoiDrawing = this.handleRoiDrawing.bind(this)
    this.handleRoiModification = this.handleRoiModification.bind(this)
    this.handleRoiVisibility = this.handleRoiVisibility.bind(this)
    this.handleAnnotationVisibility = this.handleAnnotationVisibility.bind(this)
    this.handleRoiRemoval = this.handleRoiRemoval.bind(this)
    this.handleAnnotationSelection = this.handleAnnotationSelection.bind(this)
    this.handleReportGeneration = this.handleReportGeneration.bind(this)
    this.handleAnnotationFindingSelection = this.handleAnnotationFindingSelection.bind(this)
    this.handleAnnotationCompletion = this.handleAnnotationCompletion.bind(this)
    this.handleAnnotationCancellation = this.handleAnnotationCancellation.bind(this)
    this.handleReportVerification = this.handleReportVerification.bind(this)
    this.handleReportCancellation = this.handleReportCancellation.bind(this)
  }

  componentDidUpdate (previousProps: SlideViewerProps) {
    /* Fetch data and update the viewports if the route has changed,
     * i.e., if another series has been selected.
     */
    if (this.props.location !== previousProps.location) {
      console.log(
        'switch viewports from series ' +
        previousProps.seriesInstanceUID +
        ' to series' +
        this.props.seriesInstanceUID
      )
      this.populateViewports()
    }
  }

  /* Retrieve structured report instances that contain regions of interests
   * with 3D spatial coordinates defined in the same frame of reference as the
   * currently selected series and adds them to the VOLUME image viewer.
   */
  addAnnotations (): void {
    console.info('search for Comprehensive 3D SR instances')
    this.setState(state => ({ isLoading: true }))
    this.props.client.searchForInstances({
      studyInstanceUID: this.props.studyInstanceUID,
      queryParams: {
        Modality: 'SR',
        SOPClassUID: '1.2.840.10008.5.1.4.1.1.88.34'
      }
    }).then((matchedInstances): void => {
      matchedInstances.forEach(i => {
        const instance = dmv.metadata.formatMetadata(i) as dmv.metadata.Instance
        console.info(`retrieve SR instance "${instance.SOPInstanceUID}"`)
        this.props.client.retrieveInstance({
          studyInstanceUID: instance.StudyInstanceUID,
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
            const image = (
              this.state.metadata[0] as
              dmv.metadata.VLWholeSlideMicroscopyImage
            )
            if (scoord3d.frameOfReferenceUID === image.FrameOfReferenceUID) {
              if (this.volumeViewer !== undefined) {
                const key = _getRoiKey(roi)
                const style = this.roiStyles[key]
                this.volumeViewer.addROI(roi, style)
              } else {
                console.error(
                  `could not add ROI "${roi.uid}" ` +
                  'because viewer has not yet been instantiated'
                )
              }
            }
          })
          // State update will also ensure that the component is re-rendered.
          this.setState(state => ({ isLoading: false }))
        }).catch((error) => {
          message.error('An error occured. Annotation could not be loaded')
          console.error(error)
        })
      })
    }).catch((error) => {
      message.error('An error occured. Annotations could not be loaded')
      console.error(error)
    })
  }

  /* Retrieve metadata for image instances in the currently selected series and
   * instantiate the VOLUME and LABEL image viewers.
   */
  populateViewports (): void {
    console.info(
      `retrieve metadata for series "${this.props.seriesInstanceUID}"`
    )
    this.setState(state => ({ isLoading: true }))
    this.props.client.retrieveSeriesMetadata({
      studyInstanceUID: this.props.studyInstanceUID,
      seriesInstanceUID: this.props.seriesInstanceUID
    }).then((retrievedMetadata): void => {
      const series: dmv.metadata.VLWholeSlideMicroscopyImage[] = []
      retrievedMetadata.forEach(item => {
        const instance = dmv.metadata.formatMetadata(item) as dmv.metadata.VLWholeSlideMicroscopyImage
        series.push(instance)
      })
      this.setState((state) => ({ metadata: series }))

      const volumeMetadata = retrievedMetadata.filter((item, index) => {
        if (series[index].ImageType[2] === 'VOLUME') {
          return true
        }
        return false
      })
      if (this.volumeViewport.current !== null) {
        console.info(
          'instantiate viewer for VOLUME images of series ' +
          this.props.seriesInstanceUID
        )
        this.volumeViewport.current.innerHTML = ''
        this.volumeViewer = new dmv.viewer.VolumeImageViewer({
          client: this.props.client,
          metadata: volumeMetadata,
          retrieveRendered: true
        })
        this.volumeViewer.render({ container: this.volumeViewport.current })
        this.volumeViewer.activateSelectInteraction({})
      }

      const labelMetadata = retrievedMetadata.filter((item, index) => {
        if (series[index].ImageType[2] === 'LABEL') {
          return true
        }
        return false
      })
      if (this.labelViewport.current !== null) {
        this.labelViewport.current.innerHTML = ''
        if (labelMetadata.length > 0) {
          console.info(
            'instantiate viewer for LABEL image of series ' +
            this.props.seriesInstanceUID
          )
          this.labelViewer = new dmv.viewer.LabelImageViewer({
            client: this.props.client,
            metadata: labelMetadata[0],
            resizeFactor: 1,
            orientation: 'vertical'
          })
          this.labelViewer.render({ container: this.labelViewport.current })
        }
      }
    }).catch(
      (error) => {
        message.error(
          'An error occured. Metadata could not be retrieved for series ' +
          this.props.seriesInstanceUID
        )
        console.error(error)
      }
    )
    this.addAnnotations()
  }

  componentDidMount (): void {
    document.body.addEventListener(
      'dicommicroscopyviewer_roi_drawn',
      (event: CustomEventInit) => {
        const roi = event.detail.payload as dmv.roi.ROI
        console.debug(`added ROI "${roi.uid}"`)
        this.setState(state => ({
          showAnnotationModal: true,
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
    )

    document.body.addEventListener(
      'dicommicroscopyviewer_roi_selected',
      (event: CustomEventInit) => {
        const selectedRoi = event.detail.payload as dmv.roi.ROI
        if (this.volumeViewer !== undefined) {
          if (selectedRoi !== null) {
            console.debug(`selected ROI "${selectedRoi.uid}"`)
            const key = _getRoiKey(selectedRoi)
            const viewer = this.volumeViewer
            if (viewer !== undefined) {
              viewer.setROIStyle(selectedRoi.uid, this.selectedRoiStyle)
              viewer.getAllROIs().forEach((roi) => {
                if (roi.uid !== selectedRoi.uid) {
                  viewer.setROIStyle(roi.uid, this.roiStyles[key])
                }
              })
            }
            this.setState(state => ({ selectedRoiUID: selectedRoi.uid }))
          } else {
            this.setState(state => ({ selectedRoiUID: undefined }))
          }
        }
      }
    )

    document.body.addEventListener(
      'dicommicroscopyviewer_roi_removed',
      (event: CustomEventInit) => {
        const roi = event.detail.payload as dmv.roi.ROI
        console.debug(`removed ROI "${roi.uid}"`)
      }
    )

    this.populateViewports()
  }

  /* Handler that gets called when a finding has been selected for an
   * annotation after the region of interest has been drawn.
   */
  handleAnnotationFindingSelection (value: string): void {
    const selected = this.findingTypes.find(code => code.CodeValue === value)
    if (selected === undefined) {
      throw new Error('Unknown finding type selected for annotation.')
    }
    console.info(`selected finding type "${selected.CodeMeaning}"`)
    this.setState(state => ({ selectedFindingType: selected }))
  }

  /* Handler that gets called when an annotation has been completed. */
  handleAnnotationCompletion (): void {
    const annotatedRoi = this.state.annotatedRoi
    const findingType = this.state.selectedFindingType
    if (annotatedRoi !== undefined && findingType !== undefined) {
      const roi = annotatedRoi as dmv.roi.ROI
      console.info(`completed annotation of ROI "${roi.uid}"`)
      const evaluation = new dcmjs.sr.valueTypes.CodeContentItem({
        name: new dcmjs.sr.coding.CodedConcept({
          value: '121071',
          meaning: 'Finding',
          schemeDesignator: 'DCM'
        }),
        value: findingType,
        relationshipType: 'CONTAINS'
      })
      roi.addEvaluation(evaluation)
      this.setState(state => ({ annotatedRoi: roi }))
      if (this.volumeViewer !== undefined) {
        this.volumeViewer.addROIEvaluation(roi.uid, evaluation)
        const key = _buildKey(findingType)
        var style = this.roiStyles[key]
        this.volumeViewer.setROIStyle(roi.uid, style)
      }
    }
    this.setState(state => ({ showAnnotationModal: false }))
  }

  /* Handler that gets called when an annotation has been cancelled. */
  handleAnnotationCancellation (): void {
    console.info('cancel annotation')
    const annotatedRoi = this.state.annotatedRoi
    if (this.volumeViewer !== undefined && annotatedRoi !== undefined) {
      const roi = annotatedRoi as dmv.roi.ROI
      this.volumeViewer.removeROI(roi.uid)
    }
    this.setState(state => ({
      showAnnotationModal: false,
      annotatedRoi: undefined
    }))
  }

  /* Handler that gets called when a report should be generated for the current
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
        loginName: this.props.user.username
      })
    } else {
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
          uid: roi.uid,
          identifier: `Region #${i + 1}`
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
      imagingMeasurements.push(...measurements)
    }

    console.debug('create Measurement Report')
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
      showReportModal: true,
      generatedReport: dataset as dmv.metadata.Comprehensive3DSR
    }))
  }

  /* Handler that gets called when a report should be verified. The current
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
      ).catch(
        () => message.error('An error occured. Annotations were not saved.')
      )
    }
    this.setState(state => ({
      showReportModal: false,
      generatedReport: undefined
    }))
  }

  /* Handler that gets called when report generation has been cancelled. */
  handleReportCancellation (): void {
    this.setState(state => ({
      showReportModal: false,
      generatedReport: undefined
    }))
  }

  /* Handler that gets called when an annotation has been selected from the
   * current list of annotations.
   */
  handleAnnotationSelection ({ roiUID }: { roiUID: string }): void {
    if (this.volumeViewer === undefined) {
      return
    }
    console.log(`selected ROI ${roiUID}`)
    this.volumeViewer.getAllROIs().forEach((roi) => {
      const key = _getRoiKey(roi)
      var style = this.roiStyles[key]
      if (roi.uid === roiUID) {
        style = this.selectedRoiStyle
      }
      if (this.volumeViewer !== undefined) {
        this.volumeViewer.setROIStyle(roi.uid, style)
      }
    })
    this.setState(state => ({ selectedRoiUID: roiUID }))
  }

  /* Handle that gets called when the visibility of an annotation should be
   * toggled, i.e., the annotation should be either displayed or hidden.
   */
  handleAnnotationVisibility ({ roiUID }: { roiUID: string }): void {
    const viewer = this.volumeViewer
    if (viewer === undefined) {
      return
    }
    if (this.state.selectedRoiUID === undefined) {
      console.log(`show ROI ${roiUID}`)
      this.setState(state => ({ selectedRoiUID: roiUID }))
      viewer.setROIStyle(roiUID, this.selectedRoiStyle)
      viewer.getAllROIs().forEach((roi) => {
        if (roi.uid !== roiUID) {
          const key = _getRoiKey(roi)
          viewer.setROIStyle(roi.uid, this.roiStyles[key])
        }
      })
    } else {
      console.log(`hide ROI ${roiUID}`)
      this.setState(state => ({ selectedRoiUID: undefined }))
      viewer.setROIStyle(roiUID, {})
    }

  }

  /* Handler that will toggle the ROI drawing tool, i.e., either activate or
   * de-activate it, depending on its current state.
   */
  handleRoiDrawing ({ geometryType }: { geometryType: string }): void {
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
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.activateDrawInteraction({ geometryType })
    }
  }

  /* Handler that will toggle the ROI modification tool, i.e., either activate
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
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.activateModifyInteraction({})
    }
  }

  /* Handler that will toggle the ROI removal tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiRemoval (): void {
    if (this.volumeViewer === undefined) {
      return
    }
    const uid = this.state.selectedRoiUID
    if (uid === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.warning('No annotation was selected for removal')
      return
    }
    console.info('remove ROI "{uid}"')
    this.volumeViewer.removeROI(uid)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    message.info('Annotation was removed')
    this.setState(state => ({ selectedRoiUID: undefined }))
  }

  /* Handler that will toggle the ROI visibility tool, i.e., either activate
   * or de-activate it, depending on its current state.
   */
  handleRoiVisibility (): void {
    if (this.volumeViewer === undefined) {
      return
    }
    console.info('toggle visibility of ROIs')
    if (this.volumeViewer.areROIsVisible) {
      this.volumeViewer.deactivateDrawInteraction()
      this.volumeViewer.deactivateSelectInteraction()
      this.volumeViewer.deactivateModifyInteraction()
      this.volumeViewer.hideROIs()
    } else {
      this.volumeViewer.showROIs()
      this.volumeViewer.activateSelectInteraction({})
      const uid = this.state.selectedRoiUID
      if (uid !== undefined) {
        this.volumeViewer.setROIStyle(uid, this.selectedRoiStyle)
      }
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

    const handleRoiDropdown = ({ key }: { key: any }): void => {
      const geometryType = key as string
      this.handleRoiDrawing({ geometryType })
    }

    const roiMenu = (
      <Menu onClick={handleRoiDropdown}>
        <Menu.Item key='polygon'>Polygon</Menu.Item>
        <Menu.Item key='freehandpolygon'>Polygon (freehand)</Menu.Item>
      </Menu>
    )

    let report: React.ReactNode
    const dataset = this.state.generatedReport
    if (dataset !== undefined) {
      report = <Report dataset={dataset} />
    }

    let annotations: React.ReactNode
    if (rois.length > 0) {
      annotations = (
        <>
          <Divider orientation='left'>Annotations</Divider>
          <AnnotationList
            rois={rois}
            selectedRoiUID={this.state.selectedRoiUID}
            onSelection={this.handleAnnotationSelection}
          />
        </>
      )
    }

    return (
      <Layout style={{ height: '100%' }} hasSider>
        <Layout.Content style={{ height: '100%' }}>
          <Row>
            <Dropdown
              overlay={roiMenu}
              placement='bottomCenter'
              arrow
              trigger={['hover', 'click']}
            >
              <Button tooltip='Draw ROI' icon={FaDrawPolygon} />
            </Dropdown>
            <Button
              isToggle
              tooltip='Modify ROIs'
              icon={FaHandPointer}
              onClick={this.handleRoiModification}
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
            visible={this.state.showAnnotationModal}
            title='Select finding type'
            onOk={this.handleAnnotationCompletion}
            onCancel={this.handleAnnotationCancellation}
            okText='Select'
          >
            <Select
              style={{ minWidth: 130 }}
              onSelect={this.handleAnnotationFindingSelection}
              defaultActiveFirstOption
            >
              {this.findingTypes.map(code => {
                return (
                  <Select.Option key={code.CodeValue} value={code.CodeValue}>
                    {code.CodeMeaning}
                  </Select.Option>
                )
              })}
            </Select>
          </Modal>
          <Modal
            visible={this.state.showReportModal}
            title='Verify and save report'
            onOk={this.handleReportVerification}
            onCancel={this.handleReportCancellation}
            okText='Save'
          >
            {report}
          </Modal>
        </Layout.Content>

        <Layout.Sider width={300} theme='light'>
          <div style={{ height: '220px' }} ref={this.labelViewport} />
          <Divider orientation='left'>Specimens</Divider>
          <SpecimenList metadata={this.state.metadata} />
          {annotations}
        </Layout.Sider>
      </Layout>
    )
  }

}

export default withRouter(SlideViewer)
