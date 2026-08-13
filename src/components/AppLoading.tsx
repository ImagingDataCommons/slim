import { createElement } from 'react'

interface AppLoadingProps {
  label?: string
  /** When true, fills the viewport (Suspense root). */
  fullscreen?: boolean
}

/** Shared Slim brand spinner used by Suspense, app boot, and table loading. */
export function SlimSpinner(): JSX.Element {
  return createElement('div', {
    className: 'slim-app-loading-spinner',
    'aria-hidden': true,
  })
}

function AppLoading({
  label = 'Loading Slim',
  fullscreen = true,
}: AppLoadingProps): JSX.Element {
  const className = fullscreen
    ? 'slim-app-loading'
    : 'slim-app-loading slim-app-loading--inline'

  return createElement(
    'div',
    { className, role: 'status', 'aria-live': 'polite' },
    createElement(SlimSpinner),
    label !== ''
      ? createElement('p', { className: 'slim-app-loading-label' }, label)
      : null,
  )
}

export default AppLoading
