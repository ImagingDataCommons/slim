import React from "react";
import {
  FaDrawPolygon,
  FaEye,
  FaHandPointer,
  FaTrash,
  FaSave,
} from "react-icons/fa";
import {
  Divider,
  Dropdown,
  Menu,
  message,
  Modal,
  Layout,
  Row,
  Select,
} from "antd";
import * as dmv from "dicom-microscopy-viewer";
import * as dcmjs from "dcmjs";

/** Components */
import Button from "./Button";
import AnnotationList from "./AnnotationList";
import Patient from "./Patient";
import Report, { MeasurementReport } from "./Report";
import Study from "./Study";
import SeriesList from "./SeriesList";
import SpecimenList from "./SpecimenList";

/** Providers */
import { withAuth } from "../providers/AuthProvider";
import { withApp } from "../providers/AppProvider";
import { withDataStore } from "../providers/DataStoreProvider";

interface ViewerProps {
  dataStore: any;
  studyInstanceUID: string;
  app: {
    info: {
      name: string;
      version: string;
      uid: string;
    }
  };
  user?: {
    name: string;
    username: string;
    email: string;
  };
}

interface ViewerState {
  series: dmv.metadata.Series[];
  isLoading: boolean;
  selectedSeriesMetadata: dmv.metadata.VLWholeSlideMicroscopyImage[];
  selectedSeriesInstanceUID?: string;
  showAnnotationModal: boolean;
  annotatedRoi?: dmv.roi.ROI;
  selectedRoiUID?: string;
  selectedFindingType?: dcmjs.sr.coding.CodedConcept;
  showReportModal: boolean;
  generatedReport?: dmv.metadata.Comprehensive3DSR;
}

class Viewer extends React.Component<ViewerProps, ViewerState> {
  state = {
    series: [],
    isLoading: false,
    selectedSeriesMetadata: [],
    selectedSeriesInstanceUID: undefined,
    showAnnotationModal: false,
    annotatedRoi: undefined,
    selectedRoiUID: undefined,
    selectedFindingType: undefined,
    showReportModal: false,
    generatedReport: undefined,
  };

  private readonly findingTypes: dcmjs.sr.coding.CodedConcept[] = [
    new dcmjs.sr.coding.CodedConcept({
      value: "108369006",
      schemeDesignator: "SCT",
      meaning: "Tumor",
    }),
    new dcmjs.sr.coding.CodedConcept({
      value: "85756007",
      schemeDesignator: "SCT",
      meaning: "Tissue",
    }),
  ];

  private readonly volumeViewport = React.createRef<HTMLDivElement>();

  private readonly labelViewport = React.createRef<HTMLDivElement>();

  private volumeViewer?: dmv.viewer.VolumeImageViewer;

  private labelViewer?: dmv.viewer.LabelImageViewer;

  constructor(props: ViewerProps) {
    super(props);
    this.volumeViewer = undefined;
    this.labelViewer = undefined;
    this.handleSeriesSelection = this.handleSeriesSelection.bind(this);
    this.handleRoiDrawing = this.handleRoiDrawing.bind(this);
    this.handleRoiModification = this.handleRoiModification.bind(this);
    this.handleRoiVisibility = this.handleRoiVisibility.bind(this);
    this.handleRoiRemoval = this.handleRoiRemoval.bind(this);
    this.handleRoiSelection = this.handleRoiSelection.bind(this);
    this.handleReportGeneration = this.handleReportGeneration.bind(this);
    this.handleAnnotationSelection = this.handleAnnotationSelection.bind(this);
    this.handleAnnotationCompletion = this.handleAnnotationCompletion.bind(
      this
    );
    this.handleAnnotationCancellation = this.handleAnnotationCancellation.bind(
      this
    );
    this.handleReportVerification = this.handleReportVerification.bind(this);
    this.handleReportCancellation = this.handleReportCancellation.bind(this);
  }

  handleAnnotationSelection(value: string): void {
    const selected = this.findingTypes.find((code) => code.CodeValue === value);
    if (selected === undefined) {
      throw new Error("Unknown finding type selected for annotation.");
    }
    console.info(`selected finding type "${selected.CodeMeaning}"`);
    this.setState((state) => ({ selectedFindingType: selected }));
  }

  handleAnnotationCompletion(): void {
    const annotatedRoi = this.state.annotatedRoi;
    const findingType = this.state.selectedFindingType;
    if (annotatedRoi !== undefined && findingType !== undefined) {
      const roi = annotatedRoi as dmv.roi.ROI;
      console.info(`completed annotation of ROI "${roi.uid}"`);
      const evaluation = new dcmjs.sr.valueTypes.CodeContentItem({
        name: new dcmjs.sr.coding.CodedConcept({
          value: "121071",
          meaning: "Finding",
          schemeDesignator: "DCM",
        }),
        value: findingType,
        relationshipType: "CONTAINS",
      });
      roi.addEvaluation(evaluation);
      this.setState((state) => ({ annotatedRoi: roi }));
      if (this.volumeViewer !== undefined) {
        this.volumeViewer.addROIEvaluation(roi.uid, evaluation);
      }
    }
    this.setState((state) => ({ showAnnotationModal: false }));
  }

  handleAnnotationCancellation(): void {
    console.info("cancel annotation");
    const annotatedRoi = this.state.annotatedRoi;
    if (this.volumeViewer !== undefined && annotatedRoi !== undefined) {
      const roi = annotatedRoi as dmv.roi.ROI;
      this.volumeViewer.removeROI(roi.uid);
    }
    this.setState((state) => ({
      showAnnotationModal: false,
      annotatedRoi: undefined,
    }));
  }

  componentDidMount(): void {
    const studyInstanceUID = this.props.studyInstanceUID;
    console.info(`search for series of study "${studyInstanceUID}"...`);
    this.setState({ isLoading: true });
    this.props.dataStore
      .searchForSeries({
        queryParams: {
          Modality: "SM",
          StudyInstanceUID: studyInstanceUID,
        },
      })
      .then((matchedSeries: any): void => {
        matchedSeries.forEach((s: any) => {
          const series = dmv.metadata.formatMetadata(s) as dmv.metadata.Series;
          this.setState((state) => ({
            series: [...state.series, series],
            isLoading: true,
          }));
        });
        this.setState((state) => ({ isLoading: false }));
      })
      .catch((error: any): void => {
        console.error("search for image series failed: ", error);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        message.error("Image metadata could not be loaded");
      });

    document.body.addEventListener(
      "dicommicroscopyviewer_roi_drawn",
      (event: CustomEventInit) => {
        const roi = event.detail.payload as dmv.roi.ROI;
        console.debug(`added ROI "${roi.uid}"`);
        this.setState((state) => ({
          showAnnotationModal: true,
          annotatedRoi: roi,
        }));
        if (this.volumeViewer !== undefined) {
          if (this.volumeViewer.isDrawInteractionActive) {
            console.info("deactivate drawing of ROIs");
            this.volumeViewer.deactivateDrawInteraction();
            this.volumeViewer.activateSelectInteraction({});
          }
        }
      }
    );

    document.body.addEventListener(
      "dicommicroscopyviewer_roi_selected",
      (event: CustomEventInit) => {
        const roi = event.detail.payload as dmv.roi.ROI;
        if (roi !== null) {
          console.debug(`selected ROI "${roi.uid}"`);
          if (this.volumeViewer !== undefined) {
            const style: {
              stroke?: { color: number[]; width: number };
              fill?: { color: number[] };
            } = {};
            const color = [140, 184, 198];
            style.stroke = { color: [...color, 1], width: 3 };
            style.fill = { color: [...color, 0.2] };
            this.volumeViewer.setROIStyle(roi.uid, style);
          }
          this.setState((state) => ({ selectedRoiUID: roi.uid }));
        } else {
          this.setState((state) => ({ selectedRoiUID: undefined }));
        }
      }
    );

    document.body.addEventListener(
      "dicommicroscopyviewer_roi_removed",
      (event: CustomEventInit) => {
        const roi = event.detail.payload as dmv.roi.ROI;
        console.debug(`removed ROI "${roi.uid}"`);
      }
    );
  }

  handleReportGeneration(): void {
    if (this.volumeViewer === undefined) {
      return;
    }
    console.info("save ROIs");

    const rois = this.volumeViewer.getAllROIs();
    const metadata = this.volumeViewer.imageMetadata;
    // Metadata should be sorted such that the image with the highest
    // resolution is the last item in the array.
    const refImage = metadata[metadata.length - 1];
    // We assume that there is only one specimen (tissue section) per
    // ontainer (slide). Only the tissue section is tracked with a unique
    // identifier, even if the section may be composed of different biological
    // samples.
    if (refImage.SpecimenDescriptionSequence.length > 1) {
      console.error("more than one specimen has been described for the slide");
    }
    const refSpecimen = refImage.SpecimenDescriptionSequence[0];

    console.debug("create Observation Context");
    var observer;
    if (this.props.user !== undefined) {
      observer = new dcmjs.sr.templates.PersonObserverIdentifyingAttributes({
        name: this.props.user.name,
        loginName: this.props.user.username,
      });
    } else {
      observer = new dcmjs.sr.templates.PersonObserverIdentifyingAttributes({
        name: "ANONYMOUS",
      });
    }
    const observationContext = new dcmjs.sr.templates.ObservationContext({
      observerPersonContext: new dcmjs.sr.templates.ObserverContext({
        observerType: new dcmjs.sr.coding.CodedConcept({
          value: "121006",
          schemeDesignator: "DCM",
          meaning: "Person",
        }),
        observerIdentifyingAttributes: observer,
      }),
      observerDeviceContext: new dcmjs.sr.templates.ObserverContext({
        observerType: new dcmjs.sr.coding.CodedConcept({
          value: "121007",
          schemeDesignator: "DCM",
          meaning: "Device",
        }),
        observerIdentifyingAttributes: new dcmjs.sr.templates.DeviceObserverIdentifyingAttributes(
          {
            uid: this.props.app.info.uid,
            manufacturerName: "MGH Computational Pathology",
            modelName: this.props.app.info.name,
          }
        ),
      }),
      subjectContext: new dcmjs.sr.templates.SubjectContext({
        subjectClass: new dcmjs.sr.coding.CodedConcept({
          value: "121027",
          schemeDesignator: "DCM",
          meaning: "Specimen",
        }),
        subjectClassSpecificContext: new dcmjs.sr.templates.SubjectContextSpecimen(
          {
            uid: refSpecimen.SpecimenUID,
            identifier: refSpecimen.SpecimenIdentifier,
            containerIdentifier: refImage.ContainerIdentifier,
          }
        ),
      }),
    });

    console.debug("encode Imaging Measurements");
    const imagingMeasurements: dcmjs.sr.valueTypes.ContainerContentItem[] = [];
    for (let i = 0; i < rois.length; i++) {
      const roi = rois[i];
      let findingType = roi.evaluations.find(
        (property: dcmjs.sr.valueTypes.ContentItem) => {
          return property.ConceptNameCodeSequence[0].CodeValue === "121071";
        }
      );
      if (findingType === undefined) {
        throw new Error(`No finding type was specified for ROI "${roi.uid}"`);
      }
      findingType = findingType as dcmjs.sr.valueTypes.CodeContentItem;
      const group = new dcmjs.sr.templates.PlanarROIMeasurementsAndQualitativeEvaluations(
        {
          trackingIdentifier: new dcmjs.sr.templates.TrackingIdentifier({
            uid: roi.uid,
            identifier: `Region #${i + 1}`,
          }),
          referencedRegion: new dcmjs.sr.contentItems.ImageRegion3D({
            graphicType: roi.scoord3d.graphicType,
            graphicData: roi.scoord3d.graphicData,
            frameOfReferenceUID: roi.scoord3d.frameOfReferenceUID,
          }),
          findingType: new dcmjs.sr.coding.CodedConcept({
            value: findingType.ConceptCodeSequence[0].CodeValue,
            schemeDesignator:
              findingType.ConceptCodeSequence[0].CodingSchemeDesignator,
            meaning: findingType.ConceptCodeSequence[0].CodeMeaning,
          }),
        }
      );
      const measurements = group as dcmjs.sr.valueTypes.ContainerContentItem[];
      imagingMeasurements.push(...measurements);
    }

    console.debug("create Measurement Report");
    const measurementReport = new dcmjs.sr.templates.MeasurementReport({
      languageOfContentItemAndDescendants: new dcmjs.sr.templates.LanguageOfContentItemAndDescendants(
        {}
      ),
      observationContext: observationContext,
      procedureReported: new dcmjs.sr.coding.CodedConcept({
        value: "112703",
        schemeDesignator: "DCM",
        meaning: "Whole Slide Imaging",
      }),
      imagingMeasurements: imagingMeasurements,
    });

    console.info("create Comprehensive 3D SR document");
    const dataset = new dcmjs.sr.documents.Comprehensive3DSR({
      content: measurementReport[0],
      evidence: [refImage],
      seriesInstanceUID: dcmjs.data.DicomMetaDictionary.uid(),
      seriesNumber: 1,
      seriesDescription: "Whole slide image annotation",
      sopInstanceUID: dcmjs.data.DicomMetaDictionary.uid(),
      instanceNumber: 1,
      manufacturer: "MGH Computational Pathology",
    });

    this.setState((state) => ({
      showReportModal: true,
      generatedReport: dataset as dmv.metadata.Comprehensive3DSR,
    }));
  }

  handleReportVerification(): void {
    console.info("verfied report");

    const report = this.state.generatedReport;
    if (report !== undefined) {
      var dataset = (report as unknown) as dmv.metadata.Comprehensive3DSR;
      console.debug("create File Meta Information");
      const fileMetaInformationVersionArray = new Uint8Array(2);
      fileMetaInformationVersionArray[1] = 1;
      const fileMeta = {
        // FileMetaInformationVersion
        "00020001": {
          Value: [fileMetaInformationVersionArray.buffer],
          vr: "OB",
        },
        // MediaStorageSOPClassUID
        "00020002": {
          Value: [dataset.SOPClassUID],
          vr: "UI",
        },
        // MediaStorageSOPInstanceUID
        "00020003": {
          Value: [dataset.SOPInstanceUID],
          vr: "UI",
        },
        // TransferSyntaxUID
        "00020010": {
          Value: ["1.2.840.10008.1.2.1"],
          vr: "UI",
        },
        // ImplementationClassUID
        "00020012": {
          Value: [this.props.app.info.uid],
          vr: "UI",
        },
      };

      console.info("store Comprehensive 3D SR document");
      const writer = new dcmjs.data.DicomDict(fileMeta);
      writer.dict = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(dataset);
      const buffer = writer.write();
      this.props.dataStore
        .storeInstances({ datasets: [buffer] })
        .then((response: string) => message.info("Annotations were saved."))
        .catch(() =>
          message.error("An error occured. Annotations were not saved.")
        );
    }
    this.setState((state) => ({
      showReportModal: false,
      generatedReport: undefined,
    }));
  }

  handleReportCancellation(): void {
    this.setState((state) => ({
      showReportModal: false,
      generatedReport: undefined,
    }));
  }

  handleRoiSelection({ roiUID }: { roiUID: string }): void {
    if (this.volumeViewer === undefined) {
      return;
    }
    // TODO: update ROI style
    this.setState((state) => ({ selectedRoiUID: roiUID }));
  }

  handleRoiDrawing({ geometryType }: { geometryType: string }): void {
    if (this.volumeViewer === undefined) {
      return;
    }
    if (this.volumeViewer.isDrawInteractionActive) {
      console.info("deactivate drawing of ROIs");
      this.volumeViewer.deactivateDrawInteraction();
      this.volumeViewer.activateSelectInteraction({});
    } else {
      console.info(
        `activate drawing of ROIs for geometry Type ${geometryType}`
      );
      this.volumeViewer.deactivateSelectInteraction();
      this.volumeViewer.deactivateModifyInteraction();
      this.volumeViewer.activateDrawInteraction({ geometryType });
    }
  }

  handleRoiModification(): void {
    if (this.volumeViewer === undefined) {
      return;
    }
    console.info("toggle modification of ROIs");
    if (this.volumeViewer.isModifyInteractionActive) {
      this.volumeViewer.deactivateModifyInteraction();
      this.volumeViewer.activateSelectInteraction({});
    } else {
      this.volumeViewer.deactivateDrawInteraction();
      this.volumeViewer.deactivateSelectInteraction();
      this.volumeViewer.activateModifyInteraction({});
    }
  }

  handleRoiRemoval(): void {
    if (this.volumeViewer === undefined) {
      return;
    }
    const uid = this.state.selectedRoiUID;
    if (uid === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.warning("No annotation was selected for removal");
      return;
    }
    console.info('remove ROI "{uid}"');
    this.volumeViewer.removeROI(uid);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    message.info("Annotation was removed");
    this.setState((state) => ({ selectedRoiUID: undefined }));
  }

  handleRoiVisibility(): void {
    if (this.volumeViewer === undefined) {
      return;
    }
    console.info("toggle visibility of ROIs");
    if (this.volumeViewer.areROIsVisible) {
      this.volumeViewer.deactivateDrawInteraction();
      this.volumeViewer.deactivateSelectInteraction();
      this.volumeViewer.deactivateModifyInteraction();
      this.volumeViewer.hideROIs();
    } else {
      this.volumeViewer.showROIs();
      this.volumeViewer.activateSelectInteraction({});
    }
  }

  handleSeriesSelection({
    seriesInstanceUID,
  }: {
    seriesInstanceUID: string;
  }): void {
    console.info(`selected series: "${seriesInstanceUID}"`);
    this.setState((state) => ({
      selectedSeriesInstanceUID: seriesInstanceUID,
      selectedSeriesMetadata: [],
    }));

    this.props.dataStore
      .retrieveSeriesMetadata({
        studyInstanceUID: this.props.studyInstanceUID,
        seriesInstanceUID: seriesInstanceUID,
      })
      .then((retrievedMetadata: any): void => {
        const volumeMetadata = retrievedMetadata.filter((item: any) => {
          const metadata = dmv.metadata.formatMetadata(
            item
          ) as dmv.metadata.VLWholeSlideMicroscopyImage;
          if (metadata.ImageType[2] === "VOLUME") {
            this.setState((state) => ({
              selectedSeriesMetadata: [
                ...state.selectedSeriesMetadata,
                metadata,
              ],
            }));
            return true;
          }
          return false;
        });
        if (this.volumeViewport.current !== null) {
          console.info(
            `instantiate viewer for VOLUME images of series ${seriesInstanceUID}`
          );
          this.volumeViewport.current.innerHTML = "";
          this.volumeViewer = new dmv.viewer.VolumeImageViewer({
            client: this.props.dataStore,
            metadata: volumeMetadata,
            retrieveRendered: false,
          });
          this.volumeViewer.render({ container: this.volumeViewport.current });
          this.volumeViewer.activateSelectInteraction({});
        }

        const labelMetadata = retrievedMetadata.filter((item: any) => {
          const metadata = dmv.metadata.formatMetadata(
            item
          ) as dmv.metadata.VLWholeSlideMicroscopyImage;
          if (metadata.ImageType[2] === "LABEL") {
            return true;
          }
          return false;
        });
        if (this.labelViewport.current !== null) {
          this.labelViewport.current.innerHTML = "";
          if (labelMetadata.length > 0) {
            console.info(
              `instantiate viewer for LABEL image of series ${seriesInstanceUID}`
            );
            this.labelViewer = new dmv.viewer.LabelImageViewer({
              client: this.props.dataStore,
              metadata: labelMetadata[0],
              resizeFactor: 1,
              orientation: "vertical",
            });
            this.labelViewer.render({ container: this.labelViewport.current });
          }
        }

        console.info("search for Comprehensive 3D SR instances");
        this.setState((state) => ({ isLoading: true }));
        this.props.dataStore
          .searchForInstances({
            studyInstanceUID: this.props.studyInstanceUID,
            queryParams: {
              Modality: "SR",
              SOPClassUID: "1.2.840.10008.5.1.4.1.1.88.34",
            },
          })
          .then((matchedInstances: any): void => {
            matchedInstances.forEach((i: any) => {
              const instance = dmv.metadata.formatMetadata(
                i
              ) as dmv.metadata.Instance;
              console.info(`retrieve SR instance "${instance.SOPInstanceUID}"`);
              this.props.dataStore
                .retrieveInstance({
                  studyInstanceUID: instance.StudyInstanceUID,
                  seriesInstanceUID: instance.SeriesInstanceUID,
                  sopInstanceUID: instance.SOPInstanceUID,
                })
                .then((retrievedInstance: any): void => {
                  const data = dcmjs.data.DicomMessage.readFile(
                    retrievedInstance
                  );
                  const dataset = dmv.metadata.formatMetadata(data.dict);
                  const report = (dataset as unknown) as dmv.metadata.Comprehensive3DSR;
                  const content = new MeasurementReport(report);
                  content.ROIs.forEach((roi) => {
                    console.info(`add ROI "${roi.uid}"`);
                    const scoord3d = roi.scoord3d;
                    const image = this.state
                      .selectedSeriesMetadata[0] as dmv.metadata.VLWholeSlideMicroscopyImage;
                    if (
                      scoord3d.frameOfReferenceUID === image.FrameOfReferenceUID
                    ) {
                      if (this.volumeViewer !== undefined) {
                        const style: {
                          stroke?: { color: number[]; width: number };
                          fill?: { color: number[] };
                        } = {};
                        if (roi.properties.observerType === "Device") {
                          const color = [238, 175, 48];
                          style.stroke = { color: [...color, 1], width: 2 };
                          style.fill = { color: [...color, 0.2] };
                        } else {
                          const color = [38, 178, 255];
                          style.stroke = { color: [...color, 1], width: 1 };
                          style.fill = { color: [...color, 0.2] };
                        }
                        this.volumeViewer.addROI(roi, style);
                      } else {
                        console.error(
                          `could not add ROI "${roi.uid}" ` +
                            "because viewer has not yet been instantiated"
                        );
                      }
                    }
                  });
                  // State update will also ensure that the component is re-rendered.
                  this.setState((state) => ({ isLoading: false }));
                })
                .catch(() =>
                  message.error(
                    "An error occured. Annotation could not be loaded"
                  )
                );
            });
          })
          .catch(() =>
            message.error("An error occured. Annotations could not be loaded")
          );
      })
      .catch(() =>
        message.error("An error occured. Images could not be loaded")
      );
  }

  render(): React.ReactNode {
    const rois: dmv.roi.ROI[] = [];
    if (this.volumeViewer !== undefined) {
      this.volumeViewer.resize();
      rois.push(...this.volumeViewer.getAllROIs());
    }
    if (this.labelViewer !== undefined) {
      this.labelViewer.resize();
    }
    if (this.state.series.length === 0) {
      return null;
    }
    const metadata = this.state.series[0] as dmv.metadata.Study;

    const handleRoiDropdown = ({ key }: { key: any }): void => {
      const geometryType = key as string;
      this.handleRoiDrawing({ geometryType });
    };

    const roiMenu = (
      <Menu onClick={handleRoiDropdown}>
        <Menu.Item key="polygon">Polygon</Menu.Item>
        <Menu.Item key="freehandpolygon">Polygon (freehand)</Menu.Item>
      </Menu>
    );

    let report;
    const dataset = this.state.generatedReport;
    if (dataset !== undefined) {
      report = <Report dataset={dataset} />;
    }

    var annotations;
    if (rois.length > 0) {
      annotations = (
        <>
          <Divider orientation="left">Annotations</Divider>
          <AnnotationList
            rois={rois}
            selectedRoiUID={this.state.selectedRoiUID}
            onRoiSelection={this.handleRoiSelection}
          />
        </>
      );
    }

    return (
      <Layout style={{ height: "100%" }} hasSider>
        <Layout.Sider width={300} theme="light">
          <Divider orientation="left">Patient</Divider>
          <Patient metadata={metadata} />
          <Divider orientation="left">Case</Divider>
          <Study metadata={metadata} />
          <Divider orientation="left">Slides</Divider>
          <SeriesList
            dataStore={this.props.dataStore}
            metadata={this.state.series}
            onSeriesSelection={this.handleSeriesSelection}
          />
        </Layout.Sider>

        <Layout.Content style={{ height: "100%" }}>
          <Row>
            <Dropdown
              overlay={roiMenu}
              placement="bottomCenter"
              arrow
              trigger={["hover", "click"]}
            >
              <Button tooltip="Draw ROI" icon={FaDrawPolygon} />
            </Dropdown>
            <Button
              isToggle
              tooltip="Modify ROIs"
              icon={FaHandPointer}
              onClick={this.handleRoiModification}
            />
            <Button
              tooltip="Remove selected ROI"
              onClick={this.handleRoiRemoval}
              icon={FaTrash}
            />
            <Button
              isToggle
              tooltip="Show/Hide ROIs"
              icon={FaEye}
              onClick={this.handleRoiVisibility}
            />
            <Button
              tooltip="Save ROIs"
              icon={FaSave}
              onClick={this.handleReportGeneration}
            />
          </Row>
          <div
            style={{ height: "calc(100% - 50px)" }}
            ref={this.volumeViewport}
          />

          <Modal
            visible={this.state.showAnnotationModal}
            title="Select finding type"
            onOk={this.handleAnnotationCompletion}
            onCancel={this.handleAnnotationCancellation}
            okText="Select"
          >
            <Select
              style={{ minWidth: 130 }}
              onSelect={this.handleAnnotationSelection}
              defaultActiveFirstOption
            >
              {this.findingTypes.map((code) => {
                return (
                  <Select.Option key={code.CodeValue} value={code.CodeValue}>
                    {code.CodeMeaning}
                  </Select.Option>
                );
              })}
            </Select>
          </Modal>
          <Modal
            visible={this.state.showReportModal}
            title="Verify and save report"
            onOk={this.handleReportVerification}
            onCancel={this.handleReportCancellation}
            okText="Save"
          >
            {report}
          </Modal>
        </Layout.Content>

        <Layout.Sider width={300} theme="light">
          <div style={{ height: "220px" }} ref={this.labelViewport} />
          <Divider orientation="left">Specimens</Divider>
          <SpecimenList metadata={this.state.selectedSeriesMetadata} />
          {annotations}
        </Layout.Sider>
      </Layout>
    );
  }
}

export default withDataStore(withApp(withAuth(Viewer)));
