import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { Spin } from 'antd'
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
  left: 12,
  bottom: 12,
  zIndex: 10,
  pointerEvents: 'none',
  maxWidth: 300,
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 10,
  background: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid rgba(0, 0, 0, 0.1)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
  fontSize: 12,
  lineHeight: 1.45,
  color: 'rgba(0, 0, 0, 0.82)',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
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
      <div style={cardStyle}>
        {states.map((state) => {
          const isSettled = state.phase === 'done' || state.phase === 'error'
          const elapsed = (state.finishedAtMs ?? nowMs) - state.startedAtMs
          return (
            <div key={state.uid} style={rowStyle}>
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
                <div style={{ opacity: 0.85 }}>{phaseLabel(state)}</div>
                <div style={{ opacity: 0.7, fontSize: 11 }}>
                  {formatElapsedMs(elapsed)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AnnotationGroupLoadIndicator
