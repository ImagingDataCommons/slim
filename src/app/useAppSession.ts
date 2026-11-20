import { useEffect, useSyncExternalStore } from 'react'

import type AppConfig from '../AppConfig'
import { AppSession, type AppSessionState } from './AppSession'

const sessions = new WeakMap<AppConfig, AppSession>()

/**
 * The session for a configuration, created on first use. Keyed by the config
 * object so re-renders, remounts and StrictMode double rendering share one
 * OIDC manager and one set of DICOMweb clients.
 */
export function getAppSession(config: AppConfig): AppSession {
  let session = sessions.get(config)
  if (session === undefined) {
    session = new AppSession({ config })
    sessions.set(config, session)
  }
  return session
}

export interface UseAppSessionResult {
  session: AppSession
  state: AppSessionState
}

export function useAppSession(config: AppConfig): UseAppSessionResult {
  const session = getAppSession(config)
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)
  useEffect(() => session.start(), [session])
  return { session, state }
}
