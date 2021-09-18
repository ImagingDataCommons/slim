import React from 'react'
import { withRouter, RouteComponentProps } from 'react-router-dom'
import {
  Button,
  Input,
  message,
  Space,
  Table,
  TablePaginationConfig
} from 'antd'
import { ColumnsType } from 'antd/es/table'
import { FilterConfirmProps } from 'antd/es/table/interface'
import { SearchOutlined } from '@ant-design/icons'
import DicomWebManager from '../DicomWebManager'

import * as dmv from 'dicom-microscopy-viewer'

import { parseDate, parseName, parseSex, parseTime } from '../valueUtils'

interface WorklistProps extends RouteComponentProps {
  client: DicomWebManager
}

interface WorklistState {
  studies: dmv.metadata.Study[]
  isLoading: boolean
  numStudies: number
  pageSize: number
}

class Worklist extends React.Component<WorklistProps, WorklistState> {
  state = {
    studies: [],
    isLoading: false,
    numStudies: 0,
    pageSize: 10
  }

  constructor (props: WorklistProps) {
    super(props)
    this.fetchData = this.fetchData.bind(this)
    this.handleClick = this.handleClick.bind(this)
    this.handleChange = this.handleChange.bind(this)
  }

  componentDidMount (): void {
    const queryParams: { [key: string]: any } = { ModalitiesInStudy: 'SM' }
    const searchOptions = { queryParams }
    this.props.client.searchForStudies(searchOptions).then((studies) => {
      this.setState({
        numStudies: studies.length,
        studies: studies.slice(0, this.state.pageSize).map((study) => {
          const metadata = dmv.metadata.formatMetadata(study)
          return metadata as dmv.metadata.Study
        })
      })
    }).catch((error) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      message.error('An error occured. Search for studies failed.')
      console.error(error)
    })
  }

  handleClick (event: React.SyntheticEvent, study: dmv.metadata.Study): void {
    this.props.history.push(`/studies/${study.StudyInstanceUID}`)
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
    this.props.client.searchForStudies(searchOptions).then((studies) => {
      this.setState({
        studies: studies.map((study) => {
          const metadata = dmv.metadata.formatMetadata(study)
          return metadata as dmv.metadata.Study
        })
      })
    }).catch(() => message.error('Request to search for studies failed.'))
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
    const offset = this.state.pageSize * (index - 1)
    const limit = this.state.pageSize
    console.debug(`search for studies of page #${index}...`)
    const searchCriteria: { [attribute: string]: string } = {}
    for (const dataIndex in filters) {
      if (filters[dataIndex] !== null) {
        searchCriteria[dataIndex] = filters[dataIndex][0].toString()
      }
    }
    this.fetchData({ offset, limit, searchCriteria })
    this.setState({ isLoading: false })
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
        title: 'Study ID',
        dataIndex: 'AccessionNumber',
        ...this.getColumnSearchProps('AccessionNumber')
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
      }
    ]

    const pagination = {
      pageSize: this.state.pageSize,
      hideOnSinglePage: true,
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
