import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { Card, Space, Spin } from 'antd'
import type React from 'react'
import { useEffect, useState } from 'react'
import {
  type AnnotationGroupLoadState,
  formatElapsedMs,
} from '../utils/annotationGroupLoadStatus'

function phaseLabel(state: AnnotationGroupLoadState): string {
  switch (state.phase) {
    case 'index':
      return 'Fetching annotation index…'
    case 'data': {
      if (
        state.totalBytes != null &&
        state.totalBytes > 0 &&
        state.loadedBytes != null
      ) {
        const percent = Math.min(
          100,
          Math.round((state.loadedBytes / state.totalBytes) * 100),
        )
        return `Retrieving annotation data… ${percent}%`
      }
      return 'Retrieving annotation data…'
    }
    case 'decoding':
      return 'Decoding & rendering…'
    case 'done':
      return 'Loaded'
    case 'error':
      return 'Failed to load'
    default:
      return ''
  }
}

const wrapStyle: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 12,
  transform: 'translateX(-50%)',
  zIndex: 10,
  pointerEvents: 'none',
  maxWidth: 300,
}

interface AnnotationGroupLoadIndicatorProps {
  states: AnnotationGroupLoadState[]
}

/**
 * Floating card (bottom-left of the viewport) reporting bulk annotation
 * group hydrate progress: fetching the graphic index, retrieving coordinate
 * data (with byte progress when the server reports a length), and decoding
 * & rendering. A group's row lingers briefly with a checkmark after it
 * finishes, then the caller removes it.
 */
const AnnotationGroupLoadIndicator: React.FC<
  AnnotationGroupLoadIndicatorProps
> = ({ states }) => {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const isActive = states.some(
    (state) => state.phase !== 'done' && state.phase !== 'error',
  )

  useEffect(() => {
    if (!isActive) {
      return
    }
    const id = window.setInterval(() => {
      setNowMs(Date.now())
    }, 200)
    return () => {
      window.clearInterval(id)
    }
  }, [isActive])

  if (states.length === 0) {
    return null
  }

  return (
    <div style={wrapStyle}>
      <Card
        size="small"
        bordered
        style={{
          borderRadius: 0,
          pointerEvents: 'auto',
          background: '#fff',
          boxShadow:
            '0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08), 0 9px 28px 8px rgba(0,0,0,.05)',
        }}
        bodyStyle={{ padding: 12, background: '#fff' }}
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {states.map((state) => {
            const isSettled = state.phase === 'done' || state.phase === 'error'
            const elapsed = (state.finishedAtMs ?? nowMs) - state.startedAtMs
            return (
              <Space key={state.uid} align="start" size={10}>
                {isSettled ? (
                  <CheckCircleOutlined
                    style={{
                      color: state.phase === 'error' ? '#ff4d4f' : '#52c41a',
                      marginTop: 2,
                    }}
                  />
                ) : (
                  <Spin indicator={<LoadingOutlined spin />} size="small" />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{state.label}</div>
                  <div>{phaseLabel(state)}</div>
                  <div style={{ opacity: 0.65, fontSize: 12 }}>
                    {formatElapsedMs(elapsed)}
                  </div>
                </div>
              </Space>
            )
          })}
        </Space>
      </Card>
    </div>
  )
}

export default AnnotationGroupLoadIndicator
