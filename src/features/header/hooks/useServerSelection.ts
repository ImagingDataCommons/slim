import { useCallback, useState } from 'react'

import type { OidcSettings } from '../../../AppConfig'
import {
  cacheOidcConfigInput,
  getOidcConfigToApply,
  isValidOidcConfig,
  readCachedOidcConfigInput,
} from '../../../auth/oidcConfig'
import { getLocalStorage } from '../../../utils/safeStorage'
import {
  loadServerSelection,
  type ServerSelectionMode,
  saveServerSelection,
} from '../../../utils/serverSelectionStorage'
import { normalizeServerUrl } from '../../../utils/url'
import { isValidServerUrl } from '../utils/serverUrl'

export type { ServerSelectionMode }

export interface ServerSelectionParams {
  url: string
  /** New OIDC settings, null to fall back to the deployment config */
  oidc?: OidcSettings | null
}

export interface UseServerSelectionOptions {
  onServerSelection: (params: ServerSelectionParams) => void
}

export interface UseServerSelectionReturn {
  /** Currently entered/selected server URL */
  serverUrl: string
  /** Selection mode: default server or custom URL */
  mode: ServerSelectionMode
  /** Optional OIDC config (JSON) entered by the user */
  oidcConfigInput: string
  /** Whether the OIDC config entry is empty or valid */
  isOidcConfigValid: boolean
  /** Whether the default server is selected or the custom URL is valid */
  isServerUrlValid: boolean
  /** Whether the dialog is open */
  isDialogOpen: boolean
  /** Whether the current URL and OIDC config are valid for submission */
  isValid: boolean
  /** Open the selection dialog */
  openDialog: () => void
  /** Close the dialog without saving */
  cancelDialog: () => void
  /** Update the server URL input */
  setServerUrl: (url: string) => void
  /** Update the selection mode */
  setMode: (mode: ServerSelectionMode) => void
  /** Update the OIDC config input */
  setOidcConfigInput: (input: string) => void
  /** Submit the server selection */
  submitSelection: () => void
}

/**
 * Hook for managing server selection state.
 * Handles localStorage persistence, validation, and dialog state.
 */
export function useServerSelection({
  onServerSelection,
}: UseServerSelectionOptions): UseServerSelectionReturn {
  const [initialSelection] = useState(() =>
    loadServerSelection(getLocalStorage()),
  )
  const [serverUrl, setServerUrlState] = useState<string>(initialSelection.url)
  const [mode, setModeState] = useState<ServerSelectionMode>(
    initialSelection.mode,
  )
  const [oidcConfigInput, setOidcConfigInput] = useState<string>(
    readCachedOidcConfigInput,
  )

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  /** Store URL before opening dialog for revert on cancel */
  const [previousUrl, setPreviousUrl] = useState<string>('')
  const [previousMode, setPreviousMode] =
    useState<ServerSelectionMode>('default')

  const isOidcConfigValid = isValidOidcConfig(oidcConfigInput)
  const isServerUrlValid = mode === 'default' || isValidServerUrl(serverUrl)
  const isValid = isOidcConfigValid && isServerUrlValid

  const openDialog = useCallback(() => {
    setPreviousUrl(serverUrl)
    setPreviousMode(mode)
    setOidcConfigInput(readCachedOidcConfigInput())
    setIsDialogOpen(true)
  }, [serverUrl, mode])

  const cancelDialog = useCallback(() => {
    setServerUrlState(previousUrl)
    setModeState(previousMode)
    setOidcConfigInput(readCachedOidcConfigInput())
    setIsDialogOpen(false)
  }, [previousUrl, previousMode])

  const setServerUrl = useCallback((url: string) => {
    setServerUrlState(url.trim())
  }, [])

  const setMode = useCallback((newMode: ServerSelectionMode) => {
    setModeState(newMode)
  }, [])

  const submitSelection = useCallback(() => {
    /** Keep the dialog open so an invalid entry cannot wipe the cached config */
    if (!isValidOidcConfig(oidcConfigInput)) {
      return
    }
    const oidc = getOidcConfigToApply(
      oidcConfigInput,
      readCachedOidcConfigInput(),
    )

    if (mode === 'default') {
      saveServerSelection(getLocalStorage(), { url: '', mode })
      cacheOidcConfigInput(oidcConfigInput)
      onServerSelection({ url: '', oidc })
      setIsDialogOpen(false)
      return
    }

    const trimmedUrl = serverUrl.trim()
    if (!isValidServerUrl(trimmedUrl)) {
      return
    }

    const normalizedUrl = normalizeServerUrl(trimmedUrl)
    saveServerSelection(getLocalStorage(), { url: normalizedUrl, mode })
    cacheOidcConfigInput(oidcConfigInput)
    onServerSelection({ url: normalizedUrl, oidc })
    setServerUrlState(normalizedUrl)
    setIsDialogOpen(false)
  }, [mode, serverUrl, oidcConfigInput, onServerSelection])

  return {
    serverUrl,
    mode,
    oidcConfigInput,
    isOidcConfigValid,
    isServerUrlValid,
    isDialogOpen,
    isValid,
    openDialog,
    cancelDialog,
    setServerUrl,
    setMode,
    setOidcConfigInput,
    submitSelection,
  }
}
