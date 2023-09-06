import React from 'react'
import { Button, Input, Space, Table, TablePaginationConfig } from 'antd'
import { ColumnsType } from 'antd/es/table'
import { FilterConfirmProps } from 'antd/es/table/interface'
import { SearchOutlined } from '@ant-design/icons'
import DicomWebManager from '../DicomWebManager'

import * as dmv from 'dicom-microscopy-viewer'

import { StorageClasses } from '../data/uids'
import { withRouter, RouteComponentProps } from '../utils/router'
import { parseDate, parseName, parseSex, parseTime } from '../utils/values'
import { CustomError, errorTypes } from '../utils/CustomError'
import NotificationMiddleware, {
  NotificationMiddlewareContext
} from '../services/NotificationMiddleware'

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

  constructor (props: WorklistProps) {
    super(props)
    this.fetchData = this.fetchData.bind(this)
    this.handleClick = this.handleClick.bind(this)
    this.handleChange = this.handleChange.bind(this)
    this.state = {
      studies: [],
      isLoading: false,
      numStudies: 0,
      pageSize: this.defaultPageSize
    }
  }

  searchForStudies (): void {
    const queryParams: { [key: string]: any } = { ModalitiesInStudy: 'SM' }
    const searchOptions = { queryParams }
    // TODO: retrieve remaining results
    const client = this.props.clients[
      StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE
    ]
    client.searchForStudies(searchOptions).then((studies) => {
      this.setState({
        numStudies: studies.length,
        studies: studies.slice(0, this.state.pageSize).map(study => {
          const { dataset } = dmv.metadata.formatMetadata(study)
          return dataset as dmv.metadata.Study
        })
      })
    })
      .catch((error) => {
        console.error(error)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.DICOMWEB,
          new CustomError(
            errorTypes.COMMUNICATION,
            'An error occured. Search for studies failed.'
          )
        )
      })
  }

  componentDidMount (): void {
    this.searchForStudies()
  }

  componentDidUpdate (previousProps: WorklistProps): void {
    if (this.props.clients !== previousProps.clients) {
      this.searchForStudies()
    }
  }

  handleClick (event: React.SyntheticEvent, study: dmv.metadata.Study): void {
    this.props.navigate(`/studies/${study.StudyInstanceUID}`)
  }

  fetchData ({ offset, limit, searchCriteria }: {
    offset: number
    limit: number
    searchCriteria?: { [attribute: string]: string }
  }): void {
    const queryParams: { [key: string]: any } = {
      ModalitiesInStudy: 'SM',
      offset: offset,
      limit: limit
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
    const client = this.props.clients[
      StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE
    ]
    client.searchForStudies(searchOptions).then((studies) => {
      this.setState({
        studies: studies.map(study => {
          const { dataset } = dmv.metadata.formatMetadata(study)
          return dataset as dmv.metadata.Study
        })
      })
    })
      .catch((error) => {
        console.error(error)
        NotificationMiddleware.onError(
          NotificationMiddlewareContext.DICOMWEB,
          new CustomError(
            errorTypes.COMMUNICATION,
            'Request to search for studies failed.'
          )
        )
      })
  }

  handleChange (
    pagination: TablePaginationConfig,
    filters: any
  ): void {
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
      if (filters[dataIndex] !== null) {
        searchCriteria[dataIndex] = filters[dataIndex][0].toString()
      }
    }
    this.fetchData({ offset, limit, searchCriteria })
    this.setState({ isLoading: false, pageSize: pageSize })
  }

  handleSearch = (
    selectedKeys: React.Key[],
    confirm: (params?: FilterConfirmProps) => void,
    dataIndex: string
  ): void => {
    confirm()
  }

  handleReset = (clearFilters: () => void): void => {
    clearFilters()
  }

  render (): React.ReactNode {
    const columns: ColumnsType<dmv.metadata.Study> = [
      {
        title: 'Accession Number',
        dataIndex: 'AccessionNumber',
        ...this.getColumnSearchProps('AccessionNumber')
      },
      {
        title: 'Study ID',
        dataIndex: 'StudyID',
        ...this.getColumnSearchProps('StudyID')
      },
      {
        title: 'Study Date',
        dataIndex: 'StudyDate',
        render: (value: string): string => parseDate(value)
      },
      {
        title: 'Study Time',
        dataIndex: 'StudyTime',
        render: (value: string): string => parseTime(value)
      },
      {
        title: 'Patient ID',
        dataIndex: 'PatientID',
        ...this.getColumnSearchProps('PatientID')
      },
      {
        title: "Patient's Name",
        dataIndex: 'PatientName',
        render: (value: dmv.metadata.PersonName): string => parseName(value),
        ...this.getColumnSearchProps('PatientName')
      },
      {
        title: "Patient's Sex",
        dataIndex: 'PatientSex',
        render: (value: string): string => parseSex(value)
      },
      {
        title: "Patient's Birthdate",
        dataIndex: 'PatientBirthDate',
        render: (value: string): string => parseDate(value)
      },
      {
        title: "Referring Physician's Name",
        dataIndex: 'ReferringPhysicianName',
        render: (value: dmv.metadata.PersonName): string => parseName(value)
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
        }
      }
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
      total: this.state.numStudies
    }

    return (
      <Table<dmv.metadata.Study>
        style={{ cursor: 'pointer' }}
        columns={columns}
        rowKey={record => record.StudyInstanceUID}
        dataSource={this.state.studies}
        pagination={pagination}
        onRow={(record: dmv.metadata.Study): object => {
          return {
            onClick: (event: React.SyntheticEvent): void => {
              return this.handleClick(event, record)
            }
          }
        }}
        onChange={this.handleChange}
        size='small'
        loading={this.state.isLoading}
      />
    )
  }

  getColumnSearchProps = (dataIndex: string): object => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: {
      setSelectedKeys: (selectedKeys: React.Key[]) => void
      selectedKeys: React.Key[]
      confirm: (params?: FilterConfirmProps) => void
      clearFilters: () => void
    }) => (
      <div style={{ padding: 8 }}>
        <Input
          placeholder='Search'
          value={selectedKeys[0]}
          onChange={e => setSelectedKeys(
            e.target.value !== undefined ? [e.target.value] : []
          )}
          onPressEnter={() => this.handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ width: 188, marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type='primary'
            onClick={() => this.handleSearch(selectedKeys, confirm, dataIndex)}
            icon={<SearchOutlined />}
            size='small'
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => this.handleReset(clearFilters)}
            size='small'
            style={{ width: 90 }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined
        style={{ color: filtered ? '#1890ff' : undefined }}
      />
    )
  })
}

export default withRouter(Worklist)
