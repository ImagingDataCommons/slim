import React from 'react'
import { NavLink } from 'react-router-dom'
import { FaList } from 'react-icons/fa'
import { Avatar, Button, Col, Layout, Row, Space } from 'antd'
import { UserOutlined } from '@ant-design/icons'

interface HeaderProps {
  app: {
    name: string
    version: string
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
          <Button icon={<FaList />} />
        </NavLink>
      )
    }

    return (
      <Layout.Header style={{ width: '100%', padding: '0 14px' }}>
        <Row>
          <Col>
            <Space align='center' direction='horizontal'>
              {worklistButton}
            </Space>
          </Col>
          <Col flex='auto' />
          <Col>
            <Space align='center' direction='horizontal'>
              {user}
            </Space>
          </Col>
        </Row>
      </Layout.Header>
    )
  }
}

export default Header
