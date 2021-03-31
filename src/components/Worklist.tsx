import React from "react";
import { withRouter, RouteComponentProps } from "react-router-dom";
import { Table, TablePaginationConfig, message } from "antd";
import { ColumnsType } from "antd/es/table";
import * as dmv from "dicom-microscopy-viewer";

/** Providers */
import { withDataStore } from "../providers/DataStoreProvider";
import { withApp } from "../providers/AppProvider";
import { withServer } from "../providers/ServerProvider";

/** Utils */
import { parseDate, parseName, parseSex, parseTime } from "../valueUtils";
import { routes as routesUtils } from "../utils";

/** Components */
import { DICOMStorePickerModal, DICOMStoreListModal } from "../components";

interface WorklistProps extends RouteComponentProps {
  dataStore: any;
  app: any;
  servers: any;
}

interface WorklistState {
  studies: dmv.metadata.Study[];
  isLoading: boolean;
  numStudies: number;
  pageSize: number;
  isDICOMStorePickerModalOpened: boolean;
  isDICOMStoreListModalOpened: boolean;
}

class Worklist extends React.Component<WorklistProps, WorklistState> {
  constructor(props: WorklistProps) {
    super(props);
    this.fetchData = this.fetchData.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.onCloseDICOMStorePickerModal = this.onCloseDICOMStorePickerModal.bind(
      this
    );
    this.onCloseDICOMStoreListModal = this.onCloseDICOMStoreListModal.bind(
      this
    );

    this.state = {
      studies: [],
      isLoading: false,
      numStudies: 0,
      pageSize: 10,
      isDICOMStorePickerModalOpened: false,
      isDICOMStoreListModalOpened: this.props.app.config
        .enableGoogleCloudAdapter,
    };
  }

  componentDidUpdate(prevProps: WorklistProps): void {
    /** TODO: Resolve async issues with server */
    const activeServer = this.props.servers.find((s: any) => !!s.active);
    const oldServer = prevProps.servers.find((s: any) => !!s.active);
    if (activeServer !== oldServer) {
      this.retrieveStudies();
    }
  }

  componentDidMount(): void {
    this.retrieveStudies();
  }

  retrieveStudies() {
    const searchOptions = {
      queryParams: {
        ModalitiesInStudy: "SM",
      },
    };
    this.props.dataStore
      .searchForStudies(searchOptions)
      .then((studies: any) => {
        // TODO: get total number of studies from response message header
        this.setState((state) => ({ numStudies: studies.length }));
      })
      .catch(() => message.error("Request to search for studies failed."));
    this.fetchData(0, this.state.pageSize);
  }

  handleClick(event: React.SyntheticEvent, study: dmv.metadata.Study): void {
    const activeServer = this.props.servers.find((s: any) => !!s.active);
    routesUtils.updateViewerURL(
      this.props.app.config,
      activeServer,
      this.props.history,
      { studyInstanceUID: study.StudyInstanceUID },
      { metadata: study }
    );
  }

  fetchData(offset: number, limit: number): void {
    const searchOptions = {
      queryParams: {
        ModalitiesInStudy: "SM",
        offset: offset,
        limit: limit,
      },
    };
    this.props.dataStore
      .searchForStudies(searchOptions)
      .then((studies: any) => {
        this.setState((state) => ({
          studies: studies.map((study: any) => {
            const metadata = dmv.metadata.formatMetadata(study);
            return metadata as dmv.metadata.Study;
          }),
        }));
      })
      .catch(() => message.error("Request to search for studies failed."));
  }

  handleChange(pagination: TablePaginationConfig): void {
    // TODO: sorter.field, sorter.order
    this.setState((state) => ({ isLoading: true }));
    let index = pagination.current;
    if (index === undefined) {
      index = 1;
    }
    const offset = this.state.pageSize * (index - 1);
    const limit = this.state.pageSize;
    console.debug(`search for studies of page #${index}...`);
    this.fetchData(offset, limit);
    this.setState((state) => ({ isLoading: false }));
  }

  onCloseDICOMStorePickerModal() {
    this.setState({
      isDICOMStorePickerModalOpened: !this.state.isDICOMStorePickerModalOpened,
    });
  }

  onCloseDICOMStoreListModal() {
    this.setState({
      isDICOMStoreListModalOpened: !this.state.isDICOMStoreListModalOpened,
    });
  }

  render(): React.ReactNode {
    const columns: ColumnsType<dmv.metadata.Study> = [
      {
        title: "Study ID",
        dataIndex: "AccessionNumber",
      },
      {
        title: "Study Date",
        dataIndex: "StudyDate",
        render: (value: string): string => parseDate(value),
      },
      {
        title: "Study Time",
        dataIndex: "StudyTime",
        render: (value: string): string => parseTime(value),
      },
      {
        title: "Patient ID",
        dataIndex: "PatientID",
      },
      {
        title: "Patient's Name",
        dataIndex: "PatientName",
        render: (value: dmv.metadata.PersonName): string => parseName(value),
      },
      {
        title: "Patient's Sex",
        dataIndex: "PatientSex",
        render: (value: string): string => parseSex(value),
      },
      {
        title: "Patient's Birthdate",
        dataIndex: "PatientBirthDate",
        render: (value: string): string => parseDate(value),
      },
      {
        title: "Referring Physician's Name",
        dataIndex: "ReferringPhysicianName",
        render: (value: dmv.metadata.PersonName): string => parseName(value),
      },
    ];

    const pagination = {
      pageSize: this.state.pageSize,
      hideOnSinglePage: true,
      total: this.state.numStudies,
    };

    return (
      <div>
        <div className="worklist-header" style={{ padding: "20px" }}>
          <button
            onClick={this.onCloseDICOMStoreListModal}
            style={{ marginRight: "5px" }}
          >
            Change DICOM store
          </button>
          <button onClick={this.onCloseDICOMStorePickerModal}>
            Change project
          </button>
        </div>
        {this.props.app.config.enableGoogleCloudAdapter && (
          <>
            <DICOMStorePickerModal
              isOpen={this.state.isDICOMStorePickerModalOpened}
              onClose={this.onCloseDICOMStorePickerModal}
            />
            <DICOMStoreListModal
              isOpen={this.state.isDICOMStoreListModalOpened}
              onClose={this.onCloseDICOMStoreListModal}
            />
          </>
        )}
        <Table<dmv.metadata.Study>
          style={{ cursor: "pointer" }}
          columns={columns}
          rowKey={(record) => record.StudyInstanceUID}
          dataSource={this.state.studies}
          pagination={pagination}
          onRow={(record: dmv.metadata.Study): object => {
            return {
              onClick: (event: React.SyntheticEvent): void => {
                return this.handleClick(event, record);
              },
            };
          }}
          onChange={this.handleChange}
          size="small"
          loading={this.state.isLoading}
        />
      </div>
    );
  }
}

export default withServer(withApp(withDataStore(withRouter(Worklist))));
