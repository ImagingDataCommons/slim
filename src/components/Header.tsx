import {
  ApiOutlined,
  BugOutlined,
  CheckOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  InfoOutlined,
  StopOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
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
import type { OidcSettings } from '../AppConfig'
import type { User } from '../auth'
import { SettingsButton } from '../contexts/SettingsContext'
import type DicomWebManager from '../DicomWebManager'
import NotificationMiddleware, {
  NotificationMiddlewareEvents,
} from '../services/NotificationMiddleware'
import type { CustomError } from '../utils/CustomError'
import { type RouteComponentProps, withRouter } from '../utils/router'
import {
  isGcpDicomStorePath,
  isViewerPath,
  parseSeriesInstanceUID,
} from '../utils/routes'
import { normalizeServerUrl } from '../utils/url'
import Button from './Button'
import DicomTagBrowser from './DicomTagBrowser/DicomTagBrowser'

const { TextArea } = Input

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

/**
 * Static count pill that avoids antd Badge → rc-motion `findDOMNode`
 * (deprecated under React Strict Mode).
 *
 * Layout/CSS mirrors antd Badge (compact): wrapper `line-height: 1` so the
 * header's 64px line-height cannot inflate the positioning context, and the
 * count uses `top/right: 0` + `translate(50%, -50%)` to sit on the corner.
 * Measured repro: without `line-height: 1`, a `top: -4` pill pins to y=0 and
 * AppShell `overflow: hidden` crops it.
 */
function HeaderCountBadge({
  count,
  color = '#ff4d4f',
  zIndex,
  /** Same meaning as antd Badge `offset`: [offsetX, offsetY] in px. */
  offset = [0, 0],
  children,
}: {
  count: number
  color?: string
  zIndex?: number
  offset?: [number, number]
  children?: React.ReactNode
}): JSX.Element {
  const [offsetX, offsetY] = offset
  const pill =
    count > 0 ? (
      <span
        style={{
          position: children != null ? 'absolute' : 'relative',
          top: children != null ? 0 : undefined,
          right: children != null ? 0 : undefined,
          transform:
            children != null
              ? `translate(50%, -50%) translate(${offsetX}px, ${offsetY}px)`
              : undefined,
          transformOrigin: children != null ? '100% 0%' : undefined,
          zIndex,
          display: 'inline-block',
          minWidth: 18,
          height: 18,
          padding: '0 6px',
          borderRadius: 9,
          background: color,
          color: '#fff',
          fontSize: 12,
          fontWeight: 'normal',
          lineHeight: '18px',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          boxShadow: '0 0 0 1px #fff',
          pointerEvents: 'none',
          verticalAlign: children != null ? undefined : 'middle',
        }}
      >
        {count > 99 ? '99+' : count}
      </span>
    ) : null

  if (children == null) {
    return <>{pill}</>
  }

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
    >
      {children}
      {pill}
    </span>
  )
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
  onServerSelection: ({
    url,
    oidc,
  }: {
    url: string
    oidc?: OidcSettings
  }) => void
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
  /** False only when both custom logo.svg and favicon.ico fail. */
  showLogo: boolean
  logoUrl: string
  /** Optional OIDC config JSON string entered by user */
  oidcConfigInput: string
  /** Whether the OIDC config JSON is valid */
  isOidcConfigValid: boolean
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

    const cachedOidcConfig =
      window.localStorage.getItem('slim_oidc_config') ?? ''

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
      showLogo: true,
      logoUrl: `${process.env.PUBLIC_URL}/logo.svg`,
      oidcConfigInput: cachedOidcConfig,
      isOidcConfigValid: this.isValidOidcConfig(cachedOidcConfig),
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

  private static readonly defaultLogoUrl =
    `${process.env.PUBLIC_URL}/favicon.ico`

  handleLogoError = (): void => {
    if (this.state.logoUrl !== Header.defaultLogoUrl) {
      this.setState({ logoUrl: Header.defaultLogoUrl })
      return
    }
    this.setState({ showLogo: false })
  }

  /**
   * public/logo.svg may be an empty Illustrator placeholder (viewBox only).
   * Fall back to favicon.ico, the default Slim brand mark.
   */
  handleLogoLoad = (event: React.SyntheticEvent<HTMLImageElement>): void => {
    const src = event.currentTarget.currentSrc || event.currentTarget.src
    if (!src.includes('logo.svg')) {
      return
    }
    void fetch(src)
      .then(async (response) => {
        if (!response.ok) {
          this.setState({ logoUrl: Header.defaultLogoUrl })
          return
        }
        const markup = await response.text()
        const hasGraphic =
          /<(?:path|rect|circle|ellipse|polygon|polyline|line|text|image|use|g)\b/i.test(
            markup,
          )
        if (!hasGraphic) {
          this.setState({ logoUrl: Header.defaultLogoUrl })
        }
      })
      .catch(() => {
        this.setState({ logoUrl: Header.defaultLogoUrl })
      })
  }

  isValidServerUrl = (url: string | null | undefined): boolean => {
    if (url == null || url === '') {
      return false
    }
    const trimmedUrl = url.trim()
    if (trimmedUrl === '') {
      return false
    }
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      try {
        const urlObj = new URL(trimmedUrl)
        return urlObj.protocol.startsWith('http') && urlObj.pathname.length > 0
      } catch (_TypeError) {
        return false
      }
    }
    const pathNorm = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`
    return isGcpDicomStorePath(pathNorm)
  }

  /**
   * Validates OIDC config JSON string.
   * Returns true if empty (optional) or if valid JSON with required fields.
   */
  isValidOidcConfig = (jsonStr: string | null | undefined): boolean => {
    if (jsonStr == null || jsonStr.trim() === '') {
      return true
    }
    try {
      const parsed = JSON.parse(jsonStr.trim())
      return (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.authority === 'string' &&
        parsed.authority.length > 0 &&
        typeof parsed.clientId === 'string' &&
        parsed.clientId.length > 0 &&
        typeof parsed.scope === 'string' &&
        parsed.scope.length > 0
      )
    } catch {
      return false
    }
  }

  /**
   * Parses OIDC config JSON string into OidcSettings object.
   * Returns undefined if empty or invalid.
   */
  parseOidcConfig = (
    jsonStr: string | null | undefined,
  ): OidcSettings | undefined => {
    if (jsonStr == null || jsonStr.trim() === '') {
      return undefined
    }
    try {
      const parsed = JSON.parse(jsonStr.trim())
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.authority === 'string' &&
        typeof parsed.clientId === 'string' &&
        typeof parsed.scope === 'string'
      ) {
        return {
          authority: parsed.authority,
          clientId: parsed.clientId,
          scope: parsed.scope,
          grantType: parsed.grantType,
          authorizationEndpoint: parsed.authorizationEndpoint,
          endSessionEndpoint: parsed.endSessionEndpoint,
        }
      }
    } catch {
      /** Invalid JSON */
    }
    return undefined
  }

  handleOidcConfigInput = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ): void => {
    const value = event.currentTarget.value
    this.setState({
      oidcConfigInput: value,
      isOidcConfigValid: this.isValidOidcConfig(value),
    })
  }

  static handleUserMenuButtonClick(e: React.SyntheticEvent): void {
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

    const seriesInstanceUID = parseSeriesInstanceUID(
      this.props.location.pathname,
    )

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
          `${this.state.errorObj[i].message as string} (Source: ${
            this.state.errorObj[i].source
          })`,
        )
      }
    }

    const { Panel } = Collapse

    const showErrorCount = (errcount: number): JSX.Element => (
      <HeaderCountBadge count={errcount} />
    )

    const showWarningCount = (warncount: number): JSX.Element => (
      <HeaderCountBadge
        count={warncount}
        color={warncount > 0 ? '#52c41a' : '#ff4d4f'}
      />
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
    const cachedOidcConfig =
      window.localStorage.getItem('slim_oidc_config') ?? ''
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
      oidcConfigInput: cachedOidcConfig,
      isOidcConfigValid: this.isValidOidcConfig(cachedOidcConfig),
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

    /** Save OIDC config to localStorage */
    const oidcConfig = this.parseOidcConfig(this.state.oidcConfigInput)
    if (oidcConfig != null) {
      window.localStorage.setItem(
        'slim_oidc_config',
        this.state.oidcConfigInput.trim(),
      )
    } else {
      window.localStorage.removeItem('slim_oidc_config')
    }

    if (this.state.serverSelectionMode === 'default') {
      this.props.onServerSelection({ url: '', oidc: oidcConfig })
      this.setState({
        isServerSelectionModalVisible: false,
        isServerSelectionDisabled: false,
      })
      return
    }

    const url = this.state.selectedServerUrl?.trim()
    let closeModal = false
    let resolvedUrl: string | undefined
    if (url !== null && url !== undefined && url !== '') {
      if (this.isValidServerUrl(url)) {
        resolvedUrl = normalizeServerUrl(url)
        this.props.onServerSelection({ url: resolvedUrl, oidc: oidcConfig })
        closeModal = true
      }
    }
    this.setState({
      isServerSelectionModalVisible: !closeModal,
      isServerSelectionDisabled: !closeModal,
      ...(closeModal &&
        resolvedUrl !== undefined && {
          selectedServerUrl: resolvedUrl,
        }),
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
            onClick={Header.handleUserMenuButtonClick}
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
      <HeaderCountBadge count={this.state.errorObj.length} zIndex={1000}>
        <HeaderCountBadge
          count={this.state.warnings.length}
          color="#52c41a"
          zIndex={1001}
          offset={this.state.errorObj.length > 0 ? [-16, 0] : [0, 0]}
        >
          <Button
            icon={BugOutlined}
            tooltip="Debug info"
            onClick={this.handleDebugButtonClick}
          />
        </HeaderCountBadge>
      </HeaderCountBadge>
    )

    const showDicomTagBrowser = isViewerPath(this.props.location.pathname)

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

    const selectedServerUrl =
      this.props.clients?.default?.baseURL ??
      this.props.defaultClients?.default?.baseURL ??
      this.state.selectedServerUrl?.trim()

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
              paddingRight: 16,
              paddingLeft: this.state.showLogo ? 16 : 0,
            }}
            title={selectedServerUrl}
          >
            {selectedServerUrl}
          </div>
        </Tooltip>
      ) : null

    return (
      <>
        <Layout.Header style={{ width: '100%', padding: '0 16px' }}>
          <Row style={{ flexWrap: 'nowrap' }} align="middle">
            {this.state.showLogo ? (
              <Col style={{ flexShrink: 0 }}>
                <img
                  src={this.state.logoUrl}
                  alt="Slim"
                  onError={this.handleLogoError}
                  onLoad={this.handleLogoLoad}
                  style={
                    this.state.logoUrl === Header.defaultLogoUrl
                      ? {
                          display: 'block',
                          height: 32,
                          width: 32,
                          objectFit: 'contain',
                        }
                      : {
                          // Preserve legacy sizing for deployments with a custom logo.svg
                          display: 'block',
                          height: 64,
                          margin: '-14px',
                          width: 'auto',
                          objectFit: 'contain',
                        }
                  }
                />
              </Col>
            ) : null}
            <Col flex="auto" style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ width: '100%', overflow: 'hidden' }}>
                {this.props.showServerSelectionButton ? urlInfo : ''}
              </div>
            </Col>
            <Col style={{ flexShrink: 0 }}>
              <Space direction="horizontal">
                {worklistButton}
                {infoButton}
                {dicomTagBrowserButton}
                {serverSelectionButton}
                {debugButton}
                <SettingsButton />
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
                placeholder="Full URL or GCP path (e.g. /projects/.../dicomStores/my-store)"
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

          <div style={{ marginTop: '16px' }}>
            <Typography.Text>
              OIDC Configuration (optional)
              <Tooltip
                title={
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                    }}
                  >
                    {`Example JSON format:
{
  "authority": "https://accounts.google.com",
  "clientId": "your-client-id.apps.googleusercontent.com",
  "scope": "email profile openid https://www.googleapis.com/auth/cloud-healthcare",
  "grantType": "implicit"
}`}
                  </div>
                }
                overlayStyle={{ maxWidth: '450px' }}
              >
                <InfoCircleOutlined
                  style={{
                    marginLeft: '8px',
                    color: 'rgba(0,0,0,.45)',
                    cursor: 'help',
                  }}
                />
              </Tooltip>
            </Typography.Text>
            <TextArea
              placeholder='{"authority": "https://...", "clientId": "...", "scope": "..."}'
              value={this.state.oidcConfigInput}
              onChange={this.handleOidcConfigInput}
              rows={4}
              style={{
                marginTop: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                borderColor:
                  this.state.oidcConfigInput.trim() !== '' &&
                  !this.state.isOidcConfigValid
                    ? '#ff4d4f'
                    : undefined,
              }}
            />
            {this.state.oidcConfigInput.trim() !== '' &&
              !this.state.isOidcConfigValid && (
                <Typography.Text type="danger" style={{ fontSize: '12px' }}>
                  Invalid JSON format. Required fields: authority, clientId,
                  scope
                </Typography.Text>
              )}
          </div>
        </Modal>
      </>
    )
  }
}

export default withRouter(Header)
