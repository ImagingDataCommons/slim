import React from 'react'
import { Layout } from 'antd'

interface FooterProps {
  app: {
    name: string
    version: string
    uid: string
    organization?: string
  }
}

class Footer extends React.Component<FooterProps, {}> {
  render (): React.ReactNode {
    return (
      <Layout.Footer style={{ textAlign: 'right', width: '100%' }}>
        {this.props.app.organization}
      </Layout.Footer>
    )
  }
}

export default Footer
