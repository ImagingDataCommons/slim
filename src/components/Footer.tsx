import { Layout } from 'antd'
import React from 'react'

interface FooterProps {
  app: {
    name: string
    version: string
    uid: string
    organization?: string
  }
}

/**
 * React component for the application footer.
 */
class Footer extends React.Component<FooterProps, Record<string, never>> {
  render(): React.ReactNode {
    return (
      <Layout.Footer style={{ textAlign: 'right', width: '100%' }}>
        {this.props.app.organization}
      </Layout.Footer>
    )
  }
}

export default Footer
