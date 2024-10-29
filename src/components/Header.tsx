import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  Col,
  Descriptions,
  Dropdown,
  Input,
  Layout,
  Menu,
  Modal,
  Row,
  Space,
  Badge,
  Collapse
} from 'antd'
import {
  ApiOutlined,
  CheckOutlined,
  InfoOutlined,
  StopOutlined,
  FileSearchOutlined,
  UnorderedListOutlined,
  UserOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { detect } from 'detect-browser'

import Button from './Button'
import { RouteComponentProps, withRouter } from '../utils/router'
import NotificationMiddleware, { NotificationMiddlewareEvents } from '../services/NotificationMiddleware'
import { CustomError } from '../utils/CustomError'
import { v4 as uuidv4 } from 'uuid'
import DicomTagBrowser from './DicomTagBrowser/DicomTagBrowser'

interface HeaderProps extends RouteComponentProps {
  app: {
    name: string
    version: string
    homepage: string
    uid: string
    organization?: string
  }
  user?: {
    name: string
    email: string
  }
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
}

// Update the mock display sets with more complete DICOM metadata
const mockDisplaySets = [
  {
    displaySetInstanceUID: '1.2.3.4.5.1',
    SeriesInstanceUID: '1.2.3.4.5',
    SeriesNumber: '1',
    SeriesDescription: 'Chest CT Series',
    Modality: 'CT',
    images: [
      {
        metadata: {
          '00100010': { Value: ['John Doe'], vr: 'PN' },
          '00100020': { Value: ['12345'], vr: 'LO' },
          '00080060': { Value: ['CT'], vr: 'CS' },
          '00200011': { Value: ['1'], vr: 'IS' },
          '0020000D': { Value: ['1.2.3.4.5.1.1'], vr: 'UI' }, // Study Instance UID
          '0020000E': { Value: ['1.2.3.4.5.1'], vr: 'UI' },   // Series Instance UID
          '00080070': { Value: ['MANUFACTURER'], vr: 'LO' },   // Manufacturer
          '00081030': { Value: ['Chest Study'], vr: 'LO' },    // Study Description
          '0008103E': { Value: ['Chest CT Series'], vr: 'LO' } // Series Description
        }
      }
    ]
  },
  {
    displaySetInstanceUID: '1.2.3.4.5.2',
    SeriesInstanceUID: '1.2.3.4.6',
    SeriesNumber: '2',
    SeriesDescription: 'Chest CT Series 2',
    Modality: 'CT',
    images: [
      {
        metadata: {
          '00100010': { Value: ['John Doe'], vr: 'PN' },
          '00100020': { Value: ['12345'], vr: 'LO' },
          '00080060': { Value: ['CT'], vr: 'CS' },
          '00200011': { Value: ['2'], vr: 'IS' },
          '0020000D': { Value: ['1.2.3.4.5.1.1'], vr: 'UI' },
          '0020000E': { Value: ['1.2.3.4.5.2'], vr: 'UI' },
          '00080070': { Value: ['MANUFACTURER'], vr: 'LO' },
          '00081030': { Value: ['Chest Study'], vr: 'LO' },
          '0008103E': { Value: ['Chest CT Series 2'], vr: 'LO' }
        }
      }
    ]
  }
]

/**
 * React component for the application header.
 */
class Header extends React.Component<HeaderProps, HeaderState> {
  constructor (props: HeaderProps) {
    super(props)
    this.state = {
      isServerSelectionModalVisible: false,
      isServerSelectionDisabled: true,
      errorObj: [],
      errorCategory: [],
      warnings: []
    }

    const onErrorHandler = ({ source, error }: {
      source: string
      error: CustomError
    }): void => {
      this.setState(state => ({
        ...state,
        errorObj: [...state.errorObj, { ...error, source }],
        errorCategory: [...state.errorCategory, error.type]
      }))
    }

    const onWarningHandler = (warning: string): void => {
      this.setState(state => ({
        ...state,
        warnings: [...state.warnings, warning]
      }))
    }

    NotificationMiddleware.subscribe(
      NotificationMiddlewareEvents.OnError,
      onErrorHandler
    )

    NotificationMiddleware.subscribe(
      NotificationMiddlewareEvents.OnWarning,
      onWarningHandler
    )
  }

  componentDidUpdate (prevProps: Readonly<HeaderProps>, prevState: Readonly<HeaderState>): void {
    if (((prevState.warnings.length > 0) || (prevState.errorObj.length > 0)) && this.props.location.pathname !== prevProps.location.pathname) {
      this.setState({
        isServerSelectionModalVisible: false,
        isServerSelectionDisabled: true,
        errorObj: [],
        errorCategory: [],
        warnings: []
      })
    }
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
      os: {}
    }
    if (browser != null) {
      environment.browser = {
        name: browser.name != null ? browser.name : undefined,
        version: browser.version != null ? browser.version : undefined
      }
      environment.os = {
        name: browser.os != null ? browser.os : undefined
      }
    }

    Modal.info({
      title: 'About',
      width: 600,
      content: (
        <>
          <Descriptions title='Application' column={1}>
            <Descriptions.Item label='Name'>
              {this.props.app.name}
            </Descriptions.Item>
            <Descriptions.Item label='Version'>
              {this.props.app.version}
            </Descriptions.Item>
            <Descriptions.Item label='Homepage'>
              {this.props.app.homepage}
            </Descriptions.Item>
          </Descriptions>
          <Descriptions title='Browser' column={1}>
            <Descriptions.Item label='Name'>
              {environment.browser.name}
            </Descriptions.Item>
            <Descriptions.Item label='Version'>
              {environment.browser.version}
            </Descriptions.Item>
          </Descriptions>
          <Descriptions title='Operating System' column={1}>
            <Descriptions.Item label='Name'>
              {environment.os.name}
            </Descriptions.Item>
          </Descriptions>
        </>
      ),
      onOk (): void {}
    })
  }

  handleDicomTagBrowserButtonClick = (): void => {
    const width = window.innerWidth - 300;
    Modal.info({
      title: 'DICOM Tag Browser',
      width: width,
      content: <DicomTagBrowser />,
      onOk (): void {}
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
      Visualization: []
    }

    type ObjectKey = keyof typeof errorMsgs
    const errorNum = this.state.errorObj.length

    if (errorNum > 0) {
      for (let i = 0; i < errorNum; i++) {
        const category = this.state.errorCategory[i] as ObjectKey
        errorMsgs[category].push(`${this.state.errorObj[i].message as string} (Source: ${this.state.errorObj[i].source})`)
      }
    }

    const { Panel } = Collapse

    const showErrorCount = (errcount: number): JSX.Element => (
      <Badge count={errcount} />
    )

    const showWarningCount = (warncount: number): JSX.Element => (
      <Badge color='green' count={warncount} />
    )

    Modal.info({
      title: 'Debug Information\n (Check console for more information)',
      width: 800,
      content: (
        <Collapse>
          <Panel
            header='Communication Error'
            key='communicationerror'
            extra={showErrorCount(errorMsgs.Communication.length)}
          >
            <ol>
              {errorMsgs.Communication.map(e => (
                <li key={uuidv4()}>{e}</li>
              ))}
            </ol>
          </Panel>
          <Panel
            header='Data Encoding/Decoding error'
            key='encodedecodeerror'
            extra={showErrorCount(errorMsgs.EncodingDecoding.length)}
          >
            <ol>
              {errorMsgs.EncodingDecoding.map(e => (
                <li key={uuidv4()}>{e}</li>
              ))}
            </ol>
          </Panel>
          <Panel
            header='Visualization error'
            key='visualizationerror'
            extra={showErrorCount(errorMsgs.Visualization.length)}
          >
            <ol>
              {errorMsgs.Visualization.map(e => (
                <li key={uuidv4()}>{e}</li>
              ))}
            </ol>
          </Panel>
          <Panel
            header='Authentication error'
            key='autherror'
            extra={showErrorCount(errorMsgs.Authentication.length)}
          >
            <ol>
              {errorMsgs.Authentication.map(e => (
                <li key={uuidv4()}>{e}</li>
              ))}
            </ol>
          </Panel>
          <Panel
            header='Warning'
            key='warning'
            extra={showWarningCount(this.state.warnings.length)}
          >
            <ol>
              {this.state.warnings.map(warning => (
                <li key={uuidv4()}>{warning}</li>
              ))}
            </ol>
          </Panel>
        </Collapse>
      ),
      onOk (): void {}
    })
  }

  handleServerSelectionButtonClick = (): void => {
    this.setState({ isServerSelectionModalVisible: true })
  }

  render (): React.ReactNode {
    let user = null
    if (this.props.user !== undefined) {
      const userMenuItems = []
      if (this.props.onUserLogout !== undefined) {
        userMenuItems.push(
          {
            label: 'Logout',
            key: 'user-logout',
            onClick: () => {
              if (this.props.onUserLogout !== undefined) {
                this.props.onUserLogout()
              }
            }
          }
        )
      }
      const userMenu = <Menu items={userMenuItems} />
      user = (
        <Dropdown overlay={userMenu} trigger={['click']}>
          <Button
            icon={UserOutlined}
            onClick={e => e.preventDefault()}
            label={`${this.props.user.name} (${this.props.user.email})`}
          />
        </Dropdown>
      )
    }

    let worklistButton
    if (this.props.showWorklistButton) {
      worklistButton = (
        <NavLink to='/'>
          <Button icon={UnorderedListOutlined} tooltip='Go to worklist' />
        </NavLink>
      )
    }

    const infoButton = (
      <Button
        icon={InfoOutlined}
        tooltip='Get app info'
        onClick={this.handleInfoButtonClick}
      />
    )

    const debugButton = (
      <Badge count={this.state.errorObj.length}>
        <Badge color='green' count={this.state.warnings.length}>
          <Button
            icon={SettingOutlined}
            tooltip='Debug info'
            onClick={this.handleDebugButtonClick}
          />
        </Badge>
      </Badge>
    )

    const showDicomTagBrowser = this.props.location.pathname.includes('/studies/')

    const dicomTagBrowserButton = showDicomTagBrowser ? (
      <Badge count={this.state.errorObj.length}>
        <Button
          icon={FileSearchOutlined}
          tooltip='Dicom Tag Browser'
          onClick={this.handleDicomTagBrowserButtonClick}
        />
      </Badge>
    ) : null

    let serverSelectionButton
    if (this.props.showServerSelectionButton) {
      serverSelectionButton = (
        <Button
          icon={ApiOutlined}
          tooltip='Select server'
          onClick={this.handleServerSelectionButtonClick}
        />
      )
    }

    const handleServerSelectionInput = (
      event: React.FormEvent<HTMLInputElement>
    ): void => {
      const value = event.currentTarget.value
      let isDisabled = true
      if (value != null) {
        try {
          const url = new URL(value)
          if (url.protocol.startsWith('http') && url.pathname.length > 0) {
            isDisabled = false
          }
        } catch (TypeError) {}
      }
      this.setState({
        selectedServerUrl: value,
        isServerSelectionDisabled: isDisabled
      })
    }

    const handleServerSelectionCancellation = (): void => {
      this.setState({
        selectedServerUrl: undefined,
        isServerSelectionModalVisible: false,
        isServerSelectionDisabled: true
      })
    }

    const handleServerSelection = (): void => {
      const url = this.state.selectedServerUrl
      let closeModal = false
      if (url != null && url !== '') {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          this.props.onServerSelection({ url })
          closeModal = true
        }
      }
      this.setState({
        selectedServerUrl: undefined,
        isServerSelectionModalVisible: !closeModal,
        isServerSelectionDisabled: true
      })
    }

    const logoUrl = process.env.PUBLIC_URL + '/logo.svg'

    return (
      <>
        <Layout.Header style={{ width: '100%', padding: '0 14px' }}>
          <Row>
            <Col>
              <Space align='center' direction='horizontal'>
                <img
                  src={logoUrl}
                  alt=''
                  style={{ height: '64px', margin: '-14px' }}
                />
              </Space>
            </Col>
            <Col flex='auto' />
            <Col>
              <Space direction='horizontal'>
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
          visible={this.state.isServerSelectionModalVisible}
          title='Select DICOMweb server'
          onOk={handleServerSelection}
          onCancel={handleServerSelectionCancellation}
        >
          <Input
            placeholder='Enter base URL of DICOMweb Study Service'
            onChange={handleServerSelectionInput}
            onPressEnter={handleServerSelection}
            addonAfter={
              this.state.isServerSelectionDisabled
                ? <StopOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                : <CheckOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
            }
          />
        </Modal>
      </>
    )
  }
}

export default withRouter(Header)
