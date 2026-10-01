import { detect } from 'detect-browser'

import appPackageJson from '../../../../package.json'
import { formatBrowserLabel, getDependencyVersion } from './about'

/** Deployment and environment facts shown in the Configuration and About tabs. */
export interface RuntimeInfo {
  /** `window.config`, the deployment's runtime configuration */
  config: unknown
  /** Name of the config file under public/config, without `.js` */
  configName: string
  slimCommit?: string
  dmvCommit?: string
  dmvVersion: string
  browserLabel: string
  userAgent: string
}

export interface RuntimeInfoSources {
  env: Partial<Record<string, string>>
  config: unknown
  userAgent: string
}

export function getRuntimeInfo(sources: RuntimeInfoSources): RuntimeInfo {
  const { env, config, userAgent } = sources
  return {
    config: config ?? {},
    configName: env.REACT_APP_CONFIG ?? 'local',
    slimCommit: env.REACT_APP_GIT_SHA,
    dmvCommit: env.REACT_APP_DMV_GIT_SHA,
    dmvVersion: getDependencyVersion(appPackageJson, 'dicom-microscopy-viewer'),
    browserLabel: formatBrowserLabel(detect(userAgent), userAgent),
    userAgent,
  }
}

/** Runtime info of the running app (build-time env, window.config, browser). */
export function getCurrentRuntimeInfo(): RuntimeInfo {
  return getRuntimeInfo({
    env: {
      REACT_APP_CONFIG: process.env.REACT_APP_CONFIG,
      REACT_APP_GIT_SHA: process.env.REACT_APP_GIT_SHA,
      REACT_APP_DMV_GIT_SHA: process.env.REACT_APP_DMV_GIT_SHA,
    },
    config: typeof window === 'undefined' ? undefined : window.config,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  })
}
