import React from 'react'
import { Result, Button } from 'antd';

interface InfoPageProps {
  type: string
  title?: string
  message?: string
}

const InfoPage = ({ title, message }: InfoPageProps) => {
  const onClickHandler = () => window.location.href = '/';
  return  (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      <Result
        title={title}
        subTitle={message}
        extra={
          <Button type="primary" key="console" onClick={onClickHandler}>
            Back Home
          </Button>
        }
      />
    </div>
  );
};

export default InfoPage;
