import type React from 'react'

interface AppShellProps {
  children: React.ReactNode
}

/** Full-height column shell: header on top, route content fills the rest. */
const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app text-[13px] text-ink">
      {children}
    </div>
  )
}

export default AppShell
