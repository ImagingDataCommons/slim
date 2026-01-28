import {
  ApiOutlined,
  CheckOutlined,
  FileSearchOutlined,
  InfoOutlined,
  SettingOutlined,
  StopOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Col,
  Collapse,
  Dropdown,
  Input,
  Layout,
  Modal,
  Radio,
  Row,
  Space,
  Tooltip,
  Typography,
} from 'antd'
import type { RadioChangeEvent } from 'antd/es/radio'
import { detect } from 'detect-browser'
import React from 'react'
import { NavLink } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import appPackageJson from '../../package.json'
import type { User } from '../auth'
import type DicomWebManager from '../DicomWebManager'
import NotificationMiddleware, {
  NotificationMiddlewareEvents,
} from '../services/NotificationMiddleware'
import type { CustomError } from '../utils/CustomError'
import { type RouteComponentProps, withRouter } from '../utils/router'
import Button from './Button'
import DicomTagBrowser from './DicomTagBrowser/DicomTagBrowser'

const aboutModalCopyTooltips: [React.ReactNode, React.ReactNode] = [
  'Copy hash',
  'Copied!',
]

const aboutModalStyles: Record<string, React.CSSProperties> = {
  container: {
    textAlign: 'center',
    lineHeight: 1.6,
    paddingRight: 25,
    fontSize: '1rem',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: '1.15rem',
    fontWeight: 600,
    marginBottom: 12,
  },
  link: {
    display: 'inline-block',
    marginBottom: 16,
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontWeight: 600,
    display: 'block',
    marginBottom: 4,
  },
  bodyText: {
    marginBottom: 4,
  },
  code: {
    display: 'inline-block',
    wordBreak: 'break-all',
    fontSize: '0.85rem',
  },
}

interface HeaderProps extends RouteComponentProps {
  app: {
    name: string
    version: string
    homepage: string
    uid: string
    organization?: string
  }
  user?: User
  clients?: { [key: string]: DicomWebManager }
  defaultClients?: { [key: string]: DicomWebManager }
  showWorklistButton: boolean
  onServerSelection: ({ url }: { url: string }) => void
  onUserLogout?: () => void
  showServerSelectionButton: boolean
}

interface ExtendedCustomError extends CustomError {
  source: string
}

interface HeaderState {
  selectedServerUrl?: string
  isServerSelectionModalVisible: boolean
  isServerSelectionDisabled: boolean
  errorObj: ExtendedCustomError[]
  errorCategory: string[]
  warnings: string[]
  serverSelectionMode: 'default' | 'custom'
}

/**
 * React component for the application header.
 */
class Header extends React.Component<HeaderProps, HeaderState> {
  constructor(props: HeaderProps) {
    super(props)
    const cachedServerUrl = window.localStorage
      .getItem('slim_selected_server')
      ?.trim()
    const cachedMode = window.localStorage.getItem(
      'slim_server_selection_mode',
    ) as 'default' | 'custom' | null

    this.state = {
      errorObj: [],
      errorCategory: [],
      warnings: [],
      selectedServerUrl: cachedServerUrl ?? '',
      isServerSelectionModalVisible: false,
      isServerSelectionDisabled: !this.isValidServerUrl(cachedServerUrl),
      serverSelectionMode:
        cachedMode === 'custom' &&
        cachedServerUrl !== null &&
        cachedServerUrl !== undefined &&
        cachedServerUrl !== ''
          ? 'custom'
          : 'default',
    }

    const onErrorHandler = ({
      source,
      error,
    }: {
      source: string
      error: CustomError
    }): void => {
      this.setState((state) => ({
        ...state,
        errorObj: [...state.errorObj, { ...error, source }],
        errorCategory: [...state.errorCategory, error.type],
      }))
    }

    const onWarningHandler = (warning: string): void => {
      this.setState((state) => ({
        ...state,
        warnings: [...state.warnings, warning],
      }))
    }

    NotificationMiddleware.subscribe(
      NotificationMiddlewareEvents.OnError,
      onErrorHandler,
    )

    NotificationMiddleware.subscribe(
      NotificationMiddlewareEvents.OnWarning,
      onWarningHandler,
    )
  }

  componentDidUpdate(
    prevProps: Readonly<HeaderProps>,
    prevState: Readonly<HeaderState>,
  ): void {
    if (
      (prevState.warnings.length > 0 || prevState.errorObj.length > 0) &&
      this.props.location.pathname !== prevProps.location.pathname
    ) {
      this.setState({
        isServerSelectionModalVisible: false,
        isServerSelectionDisabled: true,
        errorObj: [],
        errorCategory: [],
        warnings: [],
      })
    }
  }

  isValidServerUrl = (url: string | null | undefined): boolean => {
    if (url == null || url === '') {
      return false
    }
    const trimmedUrl = url.trim()
    if (trimmedUrl === '') {
      return false
    }
    try {
      const urlObj = new URL(trimmedUrl)
      return urlObj.protocol.startsWith('http') && urlObj.pathname.length > 0
    } catch (_TypeError) {
      return false
    }
  }

  handleUserMenuButtonClick = (e: React.SyntheticEvent): void => {
    e.preventDefault()
  }

  handleInfoButtonClick = (): void => {
    const browser = detect()
    const environment: {
      browser: {
        name?: string
        version?: string
      }
      os: {
        name?: string
      }
    } = {
      browser: {},
      os: {},
    }
    if (browser !== null && browser !== undefined) {
      environment.browser = {
        name:
          browser.name !== null && browser.name !== undefined
            ? browser.name
            : undefined,
        version:
          browser.version !== null && browser.version !== undefined
            ? browser.version
            : undefined,
      }
      environment.os = {
        name:
          browser.os !== null && browser.os !== undefined
            ? browser.os
            : undefined,
      }
    }

    const slimCommit =
      process.env.REACT_APP_GIT_SHA !== undefined &&
      process.env.REACT_APP_GIT_SHA !== ''
        ? process.env.REACT_APP_GIT_SHA
        : null
    const viewerCommit =
      process.env.REACT_APP_DMV_GIT_SHA !== undefined &&
      process.env.REACT_APP_DMV_GIT_SHA !== ''
        ? process.env.REACT_APP_DMV_GIT_SHA
        : null
    const devDeps = appPackageJson.devDependencies as
      | Record<string, string>
      | undefined
    const deps = appPackageJson.dependencies as
      | Record<string, string>
      | undefined
    const viewerVersionRaw =
      devDeps?.['dicom-microscopy-viewer'] ??
      deps?.['dicom-microscopy-viewer'] ??
      'unknown'
    const viewerVersion = viewerVersionRaw.replace(/^[^0-9]*/, '')

    const renderHashText = (hash: string | null): JSX.Element => {
      if (hash == null) {
        return (
          <Typography.Text code style={aboutModalStyles.code}>
            unknown
          </Typography.Text>
        )
      }
      return (
        <Typography.Text
          code
          style={aboutModalStyles.code}
          copyable={{
            text: hash,
            tooltips: aboutModalCopyTooltips,
          }}
        >
          {hash}
        </Typography.Text>
      )
    }

    Modal.info({
      width: 480,
      title: null,
      centered: true,
      content: (
        <div style={aboutModalStyles.container}>
          <Typography.Title level={3} style={aboutModalStyles.title}>
            <Typography.Link
              href={this.props.app.homepage}
              target="_blank"
              rel="noreferrer"
            >
              {this.props.app.name}
            </Typography.Link>
          </Typography.Title>
          <Typography.Text style={aboutModalStyles.subtitle}>
            {this.props.app.version}
          </Typography.Text>

          <div style={aboutModalStyles.section}>
            <Typography.Text style={aboutModalStyles.label}>
              Commit Hash
            </Typography.Text>
            {renderHashText(slimCommit)}
          </div>

          <div style={aboutModalStyles.section}>
            <Typography.Text style={aboutModalStyles.label}>
              <a
                href="https://github.com/MGHComputationalPathology/dicom-microscopy-viewer"
                target="_blank"
                rel="noreferrer"
              >
                DICOM Microscopy Viewer
              </a>
            </Typography.Text>
            <Typography.Text style={aboutModalStyles.bodyText}>
              Version {viewerVersion}
            </Typography.Text>
            {renderHashText(viewerCommit)}
          </div>

          <div style={aboutModalStyles.section}>
            <Typography.Text style={aboutModalStyles.label}>
              Current Browser &amp; OS
            </Typography.Text>
            <Typography.Text style={aboutModalStyles.bodyText}>
              {environment.browser.name ?? 'Unknown'}{' '}
              {environment.browser.version ?? ''}
            </Typography.Text>
            <Typography.Text style={aboutModalStyles.bodyText}>
              {environment.os.name ?? 'Unknown OS'}
            </Typography.Text>
          </div>
        </div>
      ),
      onOk: () => {
        Modal.destroyAll?.()
      },
    })
  }

  handleDicomTagBrowserButtonClick = (): void => {
    const width = window.innerWidth - 200

    let seriesInstanceUID = ''
    if (this.props.location.pathname.includes('series/')) {
      const seriesFragment = this.props.location.pathname.split('series/')[1]
      seriesInstanceUID = seriesFragment.includes('/')
        ? seriesFragment.split('/')[0]
        : seriesFragment
    }

    Modal.info({
      title: 'DICOM Tag Browser',
      width,
      content: (
        <DicomTagBrowser
          clients={this.props.clients ?? {}}
          studyInstanceUID={this.props.params.studyInstanceUID ?? ''}
          seriesInstanceUID={seriesInstanceUID}
        />
      ),
      onOk: () => {
        Modal.destroyAll?.()
      },
    })
  }

  handleDebugButtonClick = (): void => {
    const errorMsgs: {
      Authentication: string[]
      Communication: string[]
      EncodingDecoding: string[]
      Visualization: string[]
    } = {
      Authentication: [],
      Communication: [],
      EncodingDecoding: [],
      Visualization: [],
    }

    type ObjectKey = keyof typeof errorMsgs
    const errorNum = this.state.errorObj.length

    if (errorNum > 0) {
      for (let i = 0; i < errorNum; i++) {
        const category = this.state.errorCategory[i] as ObjectKey
        errorMsgs[category].push(
          `${this.state.errorObj[i].message as string} (Source: ${this.state.errorObj[i].source})`,
        )
      }
    }

    const { Panel } = Collapse

    const showErrorCount = (errcount: number): JSX.Element => (
      <Badge count={errcount} />
    )

    const showWarningCount = (warncount: number): JSX.Element => (
      <Badge color="green" count={warncount} />
    )

    Modal.info({
      title: 'Debug Information\n (Check console for more information)',
      width: 800,
      content: (
        <Collapse>
          <Panel
            header="Communication Error"
            key="communicationerror"
            extra={showErrorCount(errorMsgs.Communication.length)}
          >
            <ol>
              {errorMsgs.Communication.map((e) => (
                <li key={uuidv4()}>{e}</li>
              ))}
            </ol>
          </Panel>
          <Panel
            header="Data Encoding/Decoding error"
            key="encodedecodeerror"
            extra={showErrorCount(errorMsgs.EncodingDecoding.length)}
          >
            <ol>
              {errorMsgs.EncodingDecoding.map((e) => (
                <li key={uuidv4()}>{e}</li>
              ))}
            </ol>
          </Panel>
          <Panel
            header="Visualization error"
            key="visualizationerror"
            extra={showErrorCount(errorMsgs.Visualization.length)}
          >
            <ol>
              {errorMsgs.Visualization.map((e) => (
                <li key={uuidv4()}>{e}</li>
              ))}
            </ol>
          </Panel>
          <Panel
            header="Authentication error"
            key="autherror"
            extra={showErrorCount(errorMsgs.Authentication.length)}
          >
            <ol>
              {errorMsgs.Authentication.map((e) => (
                <li key={uuidv4()}>{e}</li>
              ))}
            </ol>
          </Panel>
          <Panel
            header="Warning"
            key="warning"
            extra={showWarningCount(this.state.warnings.length)}
          >
            <ol>
              {this.state.warnings.map((warning) => (
                <li key={uuidv4()}>{warning}</li>
              ))}
            </ol>
          </Panel>
        </Collapse>
      ),
      onOk: () => {
        Modal.destroyAll?.()
      },
    })
  }

  handleServerSelectionButtonClick = (): void => {
    this.setState({ isServerSelectionModalVisible: true })
  }

  handleServerSelectionInput = (
    event: React.FormEvent<HTMLInputElement>,
  ): void => {
    const value = event.currentTarget.value.trim()
    this.setState({
      selectedServerUrl: value,
      isServerSelectionDisabled: !this.isValidServerUrl(value),
    })
  }

  handleServerSelectionCancellation = (): void => {
    const cachedServerUrl = window.localStorage
      .getItem('slim_selected_server')
      ?.trim()
    this.setState({
      serverSelectionMode:
        cachedServerUrl !== null &&
        cachedServerUrl !== undefined &&
        cachedServerUrl !== ''
          ? 'custom'
          : 'default',
      selectedServerUrl: cachedServerUrl ?? undefined,
      isServerSelectionModalVisible: false,
      isServerSelectionDisabled: !this.isValidServerUrl(cachedServerUrl),
    })
  }

  handleServerSelectionModeChange = (e: RadioChangeEvent): void => {
    const mode = (e.target?.value ?? 'default') as 'default' | 'custom'
    this.setState({ serverSelectionMode: mode })
  }

  handleServerSelection = (): void => {
    window.localStorage.setItem(
      'slim_server_selection_mode',
      this.state.serverSelectionMode,
    )

    if (this.state.serverSelectionMode === 'default') {
      this.props.onServerSelection({ url: '' })
      this.setState({
        isServerSelectionModalVisible: false,
        isServerSelectionDisabled: false,
      })
      return
    }

    const url = this.state.selectedServerUrl?.trim()
    let closeModal = false
    if (url !== null && url !== undefined && url !== '') {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        this.props.onServerSelection({ url })
        closeModal = true
      }
    }
    this.setState({
      isServerSelectionModalVisible: !closeModal,
      isServerSelectionDisabled: !closeModal,
    })
  }

  render(): React.ReactNode {
    let user = null
    if (this.props.user !== undefined) {
      const userMenuItems = []
      if (this.props.onUserLogout !== undefined) {
        userMenuItems.push({
          label: 'Logout',
          key: 'user-logout',
          onClick: () => {
            if (this.props.onUserLogout !== undefined) {
              this.props.onUserLogout()
            }
          },
        })
      }
      const userMenu = { items: userMenuItems }
      user = (
        <Dropdown menu={userMenu} trigger={['click']}>
          <Button
            icon={UserOutlined}
            onClick={this.handleUserMenuButtonClick}
            label={`${this.props.user.name} (${this.props.user.email})`}
          />
        </Dropdown>
      )
    }

    let worklistButton: React.ReactNode
    if (this.props.showWorklistButton) {
      worklistButton = (
        <NavLink to="/">
          <Button icon={UnorderedListOutlined} tooltip="Go to worklist" />
        </NavLink>
      )
    }

    const infoButton = (
      <Button
        icon={InfoOutlined}
        tooltip="Get app info"
        onClick={this.handleInfoButtonClick}
      />
    )

    const debugButton = (
      <Badge count={this.state.errorObj.length} style={{ zIndex: 1000 }}>
        <Badge
          color="green"
          count={this.state.warnings.length}
          style={{ zIndex: 1001 }}
        >
          <Button
            icon={SettingOutlined}
            tooltip="Debug info"
            onClick={this.handleDebugButtonClick}
          />
        </Badge>
      </Badge>
    )

    const showDicomTagBrowser =
      this.props.location.pathname.includes('/studies/')

    const dicomTagBrowserButton = showDicomTagBrowser ? (
      <Button
        icon={FileSearchOutlined}
        tooltip="Dicom Tag Browser"
        onClick={this.handleDicomTagBrowserButtonClick}
      />
    ) : null

    let serverSelectionButton: React.ReactNode
    if (this.props.showServerSelectionButton) {
      serverSelectionButton = (
        <Button
          icon={ApiOutlined}
          tooltip="Select server"
          onClick={this.handleServerSelectionButtonClick}
        />
      )
    }

    const logoUrl = `${process.env.PUBLIC_URL}/logo.svg`

    const selectedServerUrl =
      this.state.serverSelectionMode === 'custom'
        ? this.state.selectedServerUrl?.trim()
        : (this.props.clients?.default?.baseURL ??
          this.props.defaultClients?.default?.baseURL)

    const urlInfo =
      selectedServerUrl !== null &&
      selectedServerUrl !== undefined &&
      selectedServerUrl !== '' ? (
        <Tooltip title={selectedServerUrl}>
          <div
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              paddingRight: '20px',
              paddingLeft: '20px',
            }}
            title={selectedServerUrl}
          >
            {selectedServerUrl}
          </div>
        </Tooltip>
      ) : null

    return (
      <>
        <Layout.Header style={{ width: '100%', padding: '0 14px' }}>
          <Row style={{ flexWrap: 'nowrap' }}>
            <Col style={{ flexShrink: 0 }}>
              <Space align="center" direction="horizontal">
                <img
                  src={logoUrl}
                  alt=""
                  style={{ height: '64px', margin: '-14px' }}
                />
              </Space>
            </Col>
            <Col flex="auto" style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ width: '100%', overflow: 'hidden' }}>
                {this.props.showServerSelectionButton ? urlInfo : ''}
              </div>
            </Col>
            <Col style={{ flexShrink: 0 }}>
              <Space direction="horizontal">
                {worklistButton}
                {infoButton}
                {debugButton}
                {dicomTagBrowserButton}
                {serverSelectionButton}
                {user}
              </Space>
            </Col>
          </Row>
        </Layout.Header>

        <Modal
          open={this.state.isServerSelectionModalVisible}
          title="Select DICOMweb server"
          onOk={this.handleServerSelection}
          onCancel={this.handleServerSelectionCancellation}
        >
          <Radio.Group
            value={this.state.serverSelectionMode}
            onChange={this.handleServerSelectionModeChange}
            style={{ marginBottom: '16px' }}
          >
            <Radio value="default">Use default server</Radio>
            <Radio value="custom">Use custom server</Radio>
          </Radio.Group>

          {this.state.serverSelectionMode === 'custom' && (
            <Tooltip title={this.state.selectedServerUrl?.trim()}>
              <Input
                placeholder="Enter base URL of DICOMweb Study Service"
                value={this.state.selectedServerUrl}
                onChange={this.handleServerSelectionInput}
                onPressEnter={this.handleServerSelection}
                addonAfter={
                  this.state.isServerSelectionDisabled ? (
                    <StopOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                  ) : (
                    <CheckOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                  )
                }
              />
            </Tooltip>
          )}
        </Modal>
      </>
    )
  }
}

export default withRouter(Header)
