import React from 'react'
import { NavLink } from 'react-router-dom'
import { FaInfo, FaList } from 'react-icons/fa'
import {
  Avatar,
  Col,
  Descriptions,
  Layout,
  Modal,
  Row,
  Space
} from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { detect } from 'detect-browser'

import Button from './Button'

interface HeaderProps {
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
}

/**
 * React component for the application header.
 */
class Header extends React.Component<HeaderProps, {}> {
  handleInfoClick = (): void => {
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

  render (): React.ReactNode {
    var user = null
    if (this.props.user !== undefined) {
      user = (
        <>
          <Avatar shape='square' icon={<UserOutlined />} />
          <span>
            {this.props.user.name} ({this.props.user.email})
          </span>
        </>
      )
    }

    let worklistButton
    if (this.props.showWorklistButton) {
      worklistButton = (
        <NavLink to='/'>
          <Button icon={FaList} tooltip='Worklist' />
        </NavLink>
      )
    }

    const infoButton = (
      <Button
        icon={FaInfo}
        tooltip='About'
        onClick={this.handleInfoClick}
      />
    )

    const logoUrl = process.env.PUBLIC_URL + '/logo.svg'

    return (
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
            <Space align='center' direction='horizontal'>
              {worklistButton}
              {infoButton}
              {user}
            </Space>
          </Col>
        </Row>
      </Layout.Header>
    )
  }
}

export default Header
