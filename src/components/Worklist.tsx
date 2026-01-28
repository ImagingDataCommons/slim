import { SearchOutlined } from '@ant-design/icons'
import { Button, Input, Space, Table, type TablePaginationConfig } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FilterConfirmProps } from 'antd/es/table/interface'
// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import type DicomWebManager from '../DicomWebManager'

import { StorageClasses } from '../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../utils/CustomError'
import { type RouteComponentProps, withRouter } from '../utils/router'
import { parseDate, parseName, parseSex, parseTime } from '../utils/values'

// Standalone function for row key generation
const getRowKey = (record: dmv.metadata.Study): string => {
  return record.StudyInstanceUID
}

interface WorklistProps extends RouteComponentProps {
  clients: { [key: string]: DicomWebManager }
}

interface WorklistState {
  studies: dmv.metadata.Study[]
  isLoading: boolean
  numStudies: number
  pageSize: number
}

class Worklist extends React.Component<WorklistProps, WorklistState> {
  private readonly defaultPageSize = 20

  constructor(props: WorklistProps) {
    super(props)
    this.state = {
      studies: [],
      isLoading: false,
      numStudies: 0,
      pageSize: this.defaultPageSize,
    }
  }

  searchForStudies(): void {
    const queryParams: Record<string, string> = { ModalitiesInStudy: 'SM' }
    const searchOptions = { queryParams }
    // TODO: retrieve remaining results
    const client =
      this.props.clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
    client
      .searchForStudies(searchOptions)
      .then((studies) => {
        this.setState({
          numStudies: studies.length,
          studies: studies.slice(0, this.state.pageSize).map((study) => {
            const { dataset } = dmv.metadata.formatMetadata(study)
            return dataset as dmv.metadata.Study
          }),
        })
      })
      .catch((error) => {
        console.error(error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.DICOMWEB,
          new CustomError(
            errorTypes.COMMUNICATION,
            'An error occured. Search for studies failed.',
          ),
        )
      })
  }

  componentDidMount(): void {
    this.searchForStudies()
  }

  componentDidUpdate(previousProps: WorklistProps): void {
    if (this.props.clients !== previousProps.clients) {
      this.searchForStudies()
    }
  }

  handleClick = (
    _event: React.SyntheticEvent,
    study: dmv.metadata.Study,
  ): void => {
    this.props.navigate(`/studies/${study.StudyInstanceUID}`)
  }

  fetchData = ({
    offset,
    limit,
    searchCriteria,
  }: {
    offset: number
    limit: number
    searchCriteria?: { [attribute: string]: string }
  }): void => {
    const queryParams: Record<string, string | number> = {
      ModalitiesInStudy: 'SM',
      offset,
      limit,
    }
    if (searchCriteria !== undefined) {
      for (const key in searchCriteria) {
        const value = searchCriteria[key]
        if (key === 'PersonName') {
          queryParams[key] = `*${value}*`
        } else {
          queryParams[key] = value
        }
      }
      queryParams.fuzzymatching = 'true'
    }
    const searchOptions = { queryParams }
    const client =
      this.props.clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
    client
      .searchForStudies(searchOptions)
      .then((studies) => {
        this.setState({
          studies: studies.map((study) => {
            const { dataset } = dmv.metadata.formatMetadata(study)
            return dataset as dmv.metadata.Study
          }),
        })
      })
      .catch((error) => {
        console.error(error)
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.DICOMWEB,
          new CustomError(
            errorTypes.COMMUNICATION,
            'Request to search for studies failed.',
          ),
        )
      })
  }

  handleChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, (React.Key | boolean)[] | null>,
  ): void => {
    this.setState({ isLoading: true })
    let index = pagination.current
    if (index === undefined) {
      index = 1
    }
    let pageSize = pagination.pageSize
    if (pageSize === undefined) {
      pageSize = this.state.pageSize
    }
    const offset = pageSize * (index - 1)
    const limit = pageSize
    console.debug(`search for studies of page #${index}...`)
    const searchCriteria: { [attribute: string]: string } = {}
    for (const dataIndex in filters) {
      const value = filters[dataIndex]
      if (value !== null && value !== undefined && value.length > 0) {
        searchCriteria[dataIndex] = value[0].toString()
      }
    }
    this.fetchData({ offset, limit, searchCriteria })
    this.setState({ isLoading: false, pageSize })
  }

  handleSearch = (
    _selectedKeys: React.Key[],
    confirm: (params?: FilterConfirmProps) => void,
    _dataIndex: string,
  ): void => {
    confirm()
  }

  handleReset = (clearFilters: () => void): void => {
    clearFilters()
  }

  handleRowProps = (record: dmv.metadata.Study): object => {
    return {
      onClick: (event: React.SyntheticEvent): void => {
        this.handleClick(event, record)
      },
    }
  }

  handlePressEnter = (
    selectedKeys: React.Key[],
    confirm: (params?: FilterConfirmProps) => void,
    dataIndex: string,
  ): void => {
    this.handleSearch(selectedKeys, confirm, dataIndex)
  }

  static handleInputChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setSelectedKeys: (selectedKeys: React.Key[]) => void,
  ): void {
    setSelectedKeys(e.target.value !== undefined ? [e.target.value] : [])
  }

  static getFilterInputChangeHandler(
    setSelectedKeys: (selectedKeys: React.Key[]) => void,
  ) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      Worklist.handleInputChange(e, setSelectedKeys)
  }

  getFilterPressEnterHandler = (
    selectedKeys: React.Key[],
    confirm: (params?: FilterConfirmProps) => void,
    dataIndex: string,
  ) => {
    return () => this.handlePressEnter(selectedKeys, confirm, dataIndex)
  }

  getFilterSearchHandler = (
    selectedKeys: React.Key[],
    confirm: (params?: FilterConfirmProps) => void,
    dataIndex: string,
  ) => {
    return () => this.handleSearch(selectedKeys, confirm, dataIndex)
  }

  getFilterResetHandler = (clearFilters: () => void) => {
    return () => this.handleReset(clearFilters)
  }

  render(): React.ReactNode {
    const columns: ColumnsType<dmv.metadata.Study> = [
      {
        title: 'Accession Number',
        dataIndex: 'AccessionNumber',
        ...this.getColumnSearchProps('AccessionNumber'),
      },
      {
        title: 'Study ID',
        dataIndex: 'StudyID',
        ...this.getColumnSearchProps('StudyID'),
      },
      {
        title: 'Study Date',
        dataIndex: 'StudyDate',
        render: (value: string): string => parseDate(value),
      },
      {
        title: 'Study Time',
        dataIndex: 'StudyTime',
        render: (value: string): string => parseTime(value),
      },
      {
        title: 'Patient ID',
        dataIndex: 'PatientID',
        ...this.getColumnSearchProps('PatientID'),
      },
      {
        title: "Patient's Name",
        dataIndex: 'PatientName',
        render: (value: dmv.metadata.PersonName): string => parseName(value),
        ...this.getColumnSearchProps('PatientName'),
      },
      {
        title: "Patient's Sex",
        dataIndex: 'PatientSex',
        render: (value: string): string => parseSex(value),
      },
      {
        title: "Patient's Birthdate",
        dataIndex: 'PatientBirthDate',
        render: (value: string): string => parseDate(value),
      },
      {
        title: "Referring Physician's Name",
        dataIndex: 'ReferringPhysicianName',
        render: (value: dmv.metadata.PersonName): string => parseName(value),
      },
      {
        title: 'Modalities in Study',
        dataIndex: 'ModalitiesInStudy',
        render: (value: string[] | string): string => {
          if (value === undefined) {
            /*
             * This should not happen, since the attribute is required.
             * However, some origin servers don't include it.
             */
            return ''
          } else {
            return String(value)
          }
        },
      },
    ]

    const pagination = {
      defaultPageSize: this.defaultPageSize,
      pageSize: this.state.pageSize,
      hideOnSinglePage: true,
      showSizeChanger: true,
      showQuickJumper: true,
      showTotal: (total: number, range: number[]) => {
        return `${range[0]}-${range[1]} of ${total} studies`
      },
      total: this.state.numStudies,
    }

    return (
      <Table<dmv.metadata.Study>
        style={{ cursor: 'pointer' }}
        columns={columns}
        rowKey={getRowKey}
        dataSource={this.state.studies}
        pagination={pagination}
        onRow={this.handleRowProps}
        onChange={this.handleChange}
        size="small"
        loading={this.state.isLoading}
      />
    )
  }

  getColumnSearchProps = (dataIndex: string): object => {
    return {
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }: {
        setSelectedKeys: (selectedKeys: React.Key[]) => void
        selectedKeys: React.Key[]
        confirm: (params?: FilterConfirmProps) => void
        clearFilters: () => void
      }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Search"
            value={selectedKeys[0]}
            onChange={Worklist.getFilterInputChangeHandler(setSelectedKeys)}
            onPressEnter={this.getFilterPressEnterHandler(
              selectedKeys,
              confirm,
              dataIndex,
            )}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              type="primary"
              onClick={this.getFilterSearchHandler(
                selectedKeys,
                confirm,
                dataIndex,
              )}
              icon={<SearchOutlined />}
              size="small"
              style={{ width: 90 }}
            >
              Search
            </Button>
            <Button
              onClick={this.getFilterResetHandler(clearFilters)}
              size="small"
              style={{ width: 90 }}
            >
              Reset
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
      ),
    }
  }
}

export default withRouter(Worklist)
