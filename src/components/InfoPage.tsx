import React from 'react'
import { Result } from 'antd'

interface InfoPageProps {
  type: string
  title?: string
  message?: string
}

const InfoPage = ({ title, message }: InfoPageProps): JSX.Element => {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}
    >
      <Result
        title={title}
        subTitle={message}
      />
    </div>
  )
}

export default InfoPage
