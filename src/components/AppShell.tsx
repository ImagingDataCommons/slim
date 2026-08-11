import type React from 'react'
import MemoryFooter from './MemoryFooter'

const shellStyle: React.CSSProperties = {
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const mainStyle: React.CSSProperties = {
  flex: '1 1 0%',
  minHeight: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

interface AppShellProps {
  children: React.ReactNode
  enableMemoryMonitoring: boolean
}

/**
 * Column shell: main pane fills leftover height; MemoryFooter stays in normal
 * document flow underneath so the map cannot extend under the bar.
 */
const AppShell: React.FC<AppShellProps> = ({
  children,
  enableMemoryMonitoring,
}) => {
  return (
    <div style={shellStyle}>
      <div style={mainStyle}>{children}</div>
      <MemoryFooter enabled={enableMemoryMonitoring} />
    </div>
  )
}

export default AppShell
