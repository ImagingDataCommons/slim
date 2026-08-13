import type React from 'react'

interface AppLoadingProps {
  label?: string
  /** When true, fills the viewport (Suspense root). */
  fullscreen?: boolean
}

/** Shared Slim brand spinner used by Suspense, app boot, and table loading. */
export function SlimSpinner(): React.ReactElement {
  return <div className="slim-app-loading-spinner" aria-hidden="true" />
}

const AppLoading: React.FC<AppLoadingProps> = ({
  label = 'Loading Slim',
  fullscreen = true,
}) => {
  const className = fullscreen
    ? 'slim-app-loading'
    : 'slim-app-loading slim-app-loading--inline'

  return (
    <div className={className} role="status" aria-live="polite">
      <SlimSpinner />
      {label !== '' ? <p className="slim-app-loading-label">{label}</p> : null}
    </div>
  )
}

export default AppLoading
