import { SearchOutlined } from '@ant-design/icons'
import { Button, Input, Pagination, Space, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type {
  FilterConfirmProps,
  TablePaginationConfig,
} from 'antd/es/table/interface'
// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import React from 'react'
import type DicomWebManager from '../DicomWebManager'

import { StorageClasses } from '../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../utils/CustomError'
import { logger } from '../utils/logger'
import { type RouteComponentProps, withRouter } from '../utils/router'
import { buildStudyPath } from '../utils/routes'
import { parseDate, parseName, parseSex, parseTime } from '../utils/values'
import { SlimSpinner } from './AppLoading'

// Standalone function for row key generation
const getRowKey = (record: dmv.metadata.Study): string => {
  return record.StudyInstanceUID
}

/** True when QIDO did not return usable (0008,0061) ModalitiesInStudy. */
function modalitiesNeedBackfill(study: dmv.metadata.Study): boolean {
  const m = study.ModalitiesInStudy as string | string[] | undefined | null
  if (m === undefined || m === null) {
    return true
  }
  if (typeof m === 'string') {
    return m.trim() === ''
  }
  if (Array.isArray(m)) {
    return m.length === 0 || m.every((x) => String(x ?? '').trim() === '')
  }
  return true
}

function formatModalitiesInStudyColumn(
  value: string[] | string | undefined,
): string {
  if (value === undefined || value === null) {
    return '\u00A0'
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '\u00A0'
    }
    return value.map(String).join(', ')
  }
  return String(value)
}

interface WorklistProps extends RouteComponentProps {
  clients: { [key: string]: DicomWebManager }
}

interface WorklistState {
  studies: dmv.metadata.Study[]
  isLoading: boolean
  numStudies: number
  pageSize: number
  currentPage: number
  /** Pixel height for Ant Design Table body scroll area; measured from the table pane. */
  tableScrollY?: number
}

class Worklist extends React.Component<WorklistProps, WorklistState> {
  private readonly defaultPageSize = 20
  private readonly tableAreaRef = React.createRef<HTMLDivElement>()
  private resizeObserver?: ResizeObserver

  /** Full QIDO result set; page/pageSize changes only slice this list. */
  private allStudies: dmv.metadata.Study[] = []

  /** Bumps when a new study list replaces the table; stale modality fetches ignore results. */
  private modalitiesEnrichmentGeneration = 0

  constructor(props: WorklistProps) {
    super(props)
    this.state = {
      studies: [],
      isLoading: false,
      numStudies: 0,
      pageSize: this.defaultPageSize,
      currentPage: 1,
    }
  }

  searchForStudies(): void {
    this.fetchStudies()
  }

  private fetchStudies = (searchCriteria?: {
    [attribute: string]: string
  }): void => {
    this.setState({ isLoading: true })
    const queryParams: Record<string, string | number | boolean> = {
      ModalitiesInStudy: 'SM',
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
      queryParams.fuzzymatching = true
    }
    const client =
      this.props.clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
    client
      .searchForStudies({ queryParams })
      .then((studies) => {
        const generation = ++this.modalitiesEnrichmentGeneration
        const formatted = studies.map((study) => {
          const { dataset } = dmv.metadata.formatMetadata(study)
          return dataset as dmv.metadata.Study
        })
        this.allStudies = formatted
        const pageSize = this.state.pageSize
        this.setState({
          isLoading: false,
          numStudies: formatted.length,
          currentPage: 1,
          studies: formatted.slice(0, pageSize),
        })
        void this.runModalitiesEnrichment(client, formatted, generation)
      })
      .catch((error) => {
        console.error(error)
        this.setState({ isLoading: false })
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
    this.bindTableHeightObserver()
    window.addEventListener('resize', this.updateTableScrollY)
  }

  componentDidUpdate(prevProps: WorklistProps, prevState: WorklistState): void {
    if (this.props.clients !== prevProps.clients) {
      this.searchForStudies()
    }
    // Pagination bar can appear/hide (hideOnSinglePage); remeasure the table pane.
    if (
      prevState.numStudies !== this.state.numStudies ||
      prevState.pageSize !== this.state.pageSize ||
      prevState.isLoading !== this.state.isLoading
    ) {
      this.updateTableScrollY()
    }
  }

  componentWillUnmount(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
    window.removeEventListener('resize', this.updateTableScrollY)
  }

  /**
   * Ant Design only splits header/body when `scroll.y` is set. Pagination lives
   * in a separate flex row, so measure only the table pane minus thead.
   */
  private bindTableHeightObserver = (): void => {
    const tableArea = this.tableAreaRef.current
    if (tableArea === null) {
      return
    }
    if (typeof ResizeObserver === 'undefined') {
      this.updateTableScrollY()
      return
    }
    this.resizeObserver?.disconnect()
    this.resizeObserver = new ResizeObserver(() => {
      this.updateTableScrollY()
    })
    this.resizeObserver.observe(tableArea)
    this.updateTableScrollY()
  }

  private updateTableScrollY = (): void => {
    const tableArea = this.tableAreaRef.current
    if (tableArea === null) {
      return
    }
    const areaHeight = tableArea.clientHeight
    if (areaHeight <= 0) {
      return
    }

    const header =
      tableArea.querySelector('.ant-table-header') ??
      tableArea.querySelector('.ant-table-thead')
    const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0

    const next = Math.max(Math.floor(areaHeight - headerHeight), 50)
    if (next !== this.state.tableScrollY) {
      this.setState({ tableScrollY: next })
    }
  }

  handleClick = (
    _event: React.SyntheticEvent,
    study: dmv.metadata.Study,
  ): void => {
    this.props.navigate(buildStudyPath(study.StudyInstanceUID))
  }

  private async collectModalitiesFromSeries(
    client: DicomWebManager,
    studyInstanceUID: string,
  ): Promise<string[]> {
    const seriesList = await client.searchForSeries({
      studyInstanceUID,
    })
    if (seriesList === null || seriesList === undefined) {
      return []
    }
    const modalities = new Set<string>()
    for (const raw of seriesList) {
      const { dataset } = dmv.metadata.formatMetadata(raw)
      const mod = (dataset as { Modality?: string }).Modality
      if (mod !== undefined && mod !== null && String(mod).trim() !== '') {
        modalities.add(String(mod))
      }
    }
    return [...modalities].sort()
  }

  /**
   * After the table renders from QIDO, fills ModalitiesInStudy from series
   * Modality when (0008,0061) was missing. Discarded if a newer study load ran.
   */
  private async runModalitiesEnrichment(
    client: DicomWebManager,
    studiesSnapshot: dmv.metadata.Study[],
    generation: number,
  ): Promise<void> {
    const need = studiesSnapshot.filter(modalitiesNeedBackfill)
    if (need.length === 0) {
      return
    }
    const byUid = await Promise.all(
      need.map(async (study) => {
        const uid = study.StudyInstanceUID
        try {
          const mods = await this.collectModalitiesFromSeries(client, uid)
          return { uid, mods }
        } catch {
          return { uid, mods: [] as string[] }
        }
      }),
    )
    if (generation !== this.modalitiesEnrichmentGeneration) {
      return
    }
    const uidToMods = new Map(byUid.map(({ uid, mods }) => [uid, mods]))
    this.setState((prev) => {
      this.allStudies = this.allStudies.map((study) => {
        const mods = uidToMods.get(study.StudyInstanceUID)
        if (mods === undefined || mods.length === 0) {
          return study
        }
        if (!modalitiesNeedBackfill(study)) {
          return study
        }
        return { ...study, ModalitiesInStudy: mods }
      })
      const offset = prev.pageSize * (prev.currentPage - 1)
      return {
        studies: this.allStudies.slice(offset, offset + prev.pageSize),
      }
    })
  }

  handleChange = (
    _pagination: TablePaginationConfig,
    filters: Record<string, (React.Key | boolean)[] | null>,
  ): void => {
    const searchCriteria: { [attribute: string]: string } = {}
    for (const dataIndex in filters) {
      const value = filters[dataIndex]
      if (value !== null && value !== undefined && value.length > 0) {
        searchCriteria[dataIndex] = value[0].toString()
      }
    }
    this.fetchStudies(
      Object.keys(searchCriteria).length > 0 ? searchCriteria : undefined,
    )
  }

  /**
   * Ant Design fires onChange for both page and pageSize changes. Size changes
   * also fire onShowSizeChange — only handle onChange, and always return to
   * page 1 when the page size changes so totals/pages stay consistent.
   */
  handlePaginationChange = (page: number, pageSize?: number): void => {
    const nextPageSize = pageSize ?? this.state.pageSize
    if (nextPageSize !== this.state.pageSize) {
      this.applyPage(1, nextPageSize)
      return
    }
    this.applyPage(page, nextPageSize)
  }

  private applyPage = (page: number, pageSize: number): void => {
    const total = this.allStudies.length
    const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1)
    const safePage = Math.min(Math.max(1, page), maxPage)
    const offset = pageSize * (safePage - 1)
    logger.debug(`show studies page #${safePage} (size ${pageSize})...`)
    this.setState({
      pageSize,
      currentPage: safePage,
      numStudies: total,
      studies: this.allStudies.slice(offset, offset + pageSize),
    })
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

  static orNbsp(s: string): string {
    return s !== '' ? s : '\u00A0'
  }

  render(): React.ReactNode {
    const orNbsp = Worklist.orNbsp
    const columns: ColumnsType<dmv.metadata.Study> = [
      {
        title: 'Accession Number',
        dataIndex: 'AccessionNumber',
        render: (v: string) => orNbsp(String(v ?? '')),
        ...this.getColumnSearchProps('AccessionNumber'),
      },
      {
        title: 'Study ID',
        dataIndex: 'StudyID',
        render: (v: string) => orNbsp(String(v ?? '')),
        ...this.getColumnSearchProps('StudyID'),
      },
      {
        title: 'Study Date',
        dataIndex: 'StudyDate',
        render: (value: string): string => orNbsp(parseDate(value)),
      },
      {
        title: 'Study Time',
        dataIndex: 'StudyTime',
        render: (value: string): string => orNbsp(parseTime(value)),
      },
      {
        title: 'Patient ID',
        dataIndex: 'PatientID',
        render: (v: string) => orNbsp(String(v ?? '')),
        ...this.getColumnSearchProps('PatientID'),
      },
      {
        title: "Patient's Name",
        dataIndex: 'PatientName',
        render: (value: dmv.metadata.PersonName): string =>
          orNbsp(parseName(value)),
        ...this.getColumnSearchProps('PatientName'),
      },
      {
        title: "Patient's Sex",
        dataIndex: 'PatientSex',
        render: (value: string): string => orNbsp(parseSex(value)),
      },
      {
        title: "Patient's Birthdate",
        dataIndex: 'PatientBirthDate',
        render: (value: string): string => orNbsp(parseDate(value)),
      },
      {
        title: "Referring Physician's Name",
        dataIndex: 'ReferringPhysicianName',
        render: (value: dmv.metadata.PersonName): string =>
          orNbsp(parseName(value)),
      },
      {
        title: 'Modalities in Study',
        dataIndex: 'ModalitiesInStudy',
        render: (value: string[] | string): string =>
          orNbsp(formatModalitiesInStudyColumn(value)),
      },
    ]

    const showPagination = this.state.numStudies > 0

    return (
      <div className="slim-worklist">
        <div className="slim-worklist-table-area">
          <div
            ref={this.tableAreaRef}
            className="slim-worklist-table-area-inner"
          >
            <Table<dmv.metadata.Study>
              style={{ cursor: 'pointer' }}
              columns={columns}
              rowKey={getRowKey}
              dataSource={this.state.studies}
              pagination={false}
              onRow={this.handleRowProps}
              onChange={this.handleChange}
              size="small"
              loading={{
                spinning: this.state.isLoading,
                indicator: <SlimSpinner />,
              }}
              scroll={
                this.state.tableScrollY === undefined
                  ? undefined
                  : { y: this.state.tableScrollY }
              }
            />
          </div>
        </div>
        {showPagination ? (
          <div className="slim-worklist-pagination">
            <Pagination
              size="small"
              current={this.state.currentPage}
              pageSize={this.state.pageSize}
              pageSizeOptions={['20', '50', '100', '200', '500']}
              total={this.state.numStudies}
              showSizeChanger
              showQuickJumper
              showTotal={(total: number, range: number[]) =>
                `${range[0]}-${range[1]} of ${total} studies`
              }
              onChange={this.handlePaginationChange}
            />
          </div>
        ) : null}
      </div>
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
            value={
              selectedKeys[0] === undefined || selectedKeys[0] === null
                ? ''
                : String(selectedKeys[0])
            }
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
