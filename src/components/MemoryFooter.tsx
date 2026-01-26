import React from 'react'
import { Layout, Typography, Space, Tag } from 'antd'
import { memoryMonitor, type MemoryInfo } from '../services/MemoryMonitor'
import NotificationMiddleware, { NotificationMiddlewareEvents } from '../services/NotificationMiddleware'

const { Text } = Typography

interface MemoryFooterProps {
  enabled?: boolean
}

interface MemoryFooterState {
  memoryInfo: MemoryInfo | null
}

/**
 * React component for displaying memory usage information in the footer.
 */
class MemoryFooter extends React.Component<MemoryFooterProps, MemoryFooterState> {
  private unsubscribeMemory?: () => void
  private lastWarningLevel: 'none' | 'high' | 'critical' = 'none'
  private lastCriticalWarningTime: number = 0
  private readonly criticalWarningThrottleMs: number = 30000

  constructor (props: MemoryFooterProps) {
    super(props)
    this.state = {
      memoryInfo: null
    }
  }

  componentDidMount (): void {
    if (this.props.enabled !== true) {
      return
    }

    this.unsubscribeMemory = memoryMonitor.subscribe((memory: MemoryInfo) => {
      this.setState({ memoryInfo: memory })

      const warningLevel = memoryMonitor.getWarningLevel(memory)

      if (warningLevel !== this.lastWarningLevel) {
        this.lastWarningLevel = warningLevel

        if (warningLevel === 'critical' && memory.usagePercentage !== null) {
          const now = Date.now()
          if (now - this.lastCriticalWarningTime >= this.criticalWarningThrottleMs) {
            this.lastCriticalWarningTime = now
            NotificationMiddleware.publish(
              NotificationMiddlewareEvents.OnWarning,
              `Critical memory usage: ${memory.usagePercentage.toFixed(1)}% used. ` +
              `Only ${memoryMonitor.formatBytes(memory.remainingBytes)} remaining. ` +
              'Consider refreshing the page or closing other tabs.'
            )
          }
        } else if (warningLevel === 'high' && memory.usagePercentage !== null) {
          NotificationMiddleware.publish(
            NotificationMiddlewareEvents.OnWarning,
            `High memory usage: ${memory.usagePercentage.toFixed(1)}% used. ` +
            `${memoryMonitor.formatBytes(memory.remainingBytes)} remaining.`
          )
        }
      }
    })

    memoryMonitor.startMonitoring()
  }

  componentWillUnmount (): void {
    if (this.unsubscribeMemory != null) {
      this.unsubscribeMemory()
    }
    memoryMonitor.stopMonitoring()
  }

  render (): React.ReactNode {
    if (this.props.enabled !== true) {
      return null
    }

    const { memoryInfo } = this.state

    if (memoryInfo === null || memoryInfo.apiMethod === 'unavailable') {
      return null
    }

    const warningLevel = memoryMonitor.getWarningLevel(memoryInfo)

    let statusColor: string
    if (warningLevel === 'critical') {
      statusColor = 'red'
    } else if (warningLevel === 'high') {
      statusColor = 'orange'
    } else {
      statusColor = 'green'
    }

    return (
      <Layout.Footer
        style={{
          padding: '4px 16px',
          lineHeight: '24px',
          backgroundColor: '#fafafa',
          borderTop: '1px solid #f0f0f0',
          fontSize: '12px'
        }}
      >
        <Space split={<span style={{ color: '#d9d9d9' }}>|</span>} size='small' wrap>
          <Text type='secondary' style={{ fontSize: '12px' }}>
            Memory:
          </Text>
          <Tag color={statusColor} style={{ margin: 0 }}>
            {memoryMonitor.formatBytes(memoryInfo.usedJSHeapSize)}
          </Tag>
          <Text type='secondary' style={{ fontSize: '12px' }}>
            of
          </Text>
          <Text style={{ fontSize: '12px' }}>
            {memoryMonitor.formatBytes(memoryInfo.jsHeapSizeLimit)}
          </Text>
          <Text type='secondary' style={{ fontSize: '12px' }}>
            ({memoryInfo.usagePercentage !== null ? `${memoryInfo.usagePercentage.toFixed(1)}%` : 'N/A'})
          </Text>
          {memoryInfo.remainingBytes !== null && (
            <>
              <Text type='secondary' style={{ fontSize: '12px' }}>
                Remaining:
              </Text>
              <Text style={{ fontSize: '12px' }}>
                {memoryMonitor.formatBytes(memoryInfo.remainingBytes)}
              </Text>
            </>
          )}
        </Space>
      </Layout.Footer>
    )
  }
}

export default MemoryFooter
