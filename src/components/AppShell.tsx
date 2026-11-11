import type React from 'react'

interface AppShellProps {
  children: React.ReactNode
}

/** Full-height column shell: header on top, route content fills the rest. */
const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="flex h-dvh w-full min-w-0 flex-col overflow-x-hidden overflow-y-hidden overscroll-none bg-app text-13 text-ink">
      {children}
    </div>
  )
}

export default AppShell
