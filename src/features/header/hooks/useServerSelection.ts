import { useCallback, useState } from 'react'

import { getLocalStorage } from '../../../utils/safeStorage'
import {
  loadServerSelection,
  type ServerSelectionMode,
  saveServerSelection,
} from '../../../utils/serverSelectionStorage'
import { normalizeServerUrl } from '../../../utils/url'
import { isValidServerUrl } from '../utils/serverUrl'

export type { ServerSelectionMode }

interface UseServerSelectionOptions {
  onServerSelection: (params: { url: string }) => void
}

interface UseServerSelectionReturn {
  /** Currently entered/selected server URL */
  serverUrl: string
  /** Selection mode: default server or custom URL */
  mode: ServerSelectionMode
  /** Whether the dialog is open */
  isDialogOpen: boolean
  /** Whether the current URL is valid for submission */
  isValid: boolean
  /** Open the selection dialog */
  openDialog: () => void
  /** Close the dialog without saving */
  cancelDialog: () => void
  /** Update the server URL input */
  setServerUrl: (url: string) => void
  /** Update the selection mode */
  setMode: (mode: ServerSelectionMode) => void
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

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  /** Store URL before opening dialog for revert on cancel */
  const [previousUrl, setPreviousUrl] = useState<string>('')
  const [previousMode, setPreviousMode] =
    useState<ServerSelectionMode>('default')

  const isValid = mode === 'default' || isValidServerUrl(serverUrl)

  const openDialog = useCallback(() => {
    setPreviousUrl(serverUrl)
    setPreviousMode(mode)
    setIsDialogOpen(true)
  }, [serverUrl, mode])

  const cancelDialog = useCallback(() => {
    setServerUrlState(previousUrl)
    setModeState(previousMode)
    setIsDialogOpen(false)
  }, [previousUrl, previousMode])

  const setServerUrl = useCallback((url: string) => {
    setServerUrlState(url.trim())
  }, [])

  const setMode = useCallback((newMode: ServerSelectionMode) => {
    setModeState(newMode)
  }, [])

  const submitSelection = useCallback(() => {
    if (mode === 'default') {
      saveServerSelection(getLocalStorage(), { url: '', mode })
      onServerSelection({ url: '' })
      setIsDialogOpen(false)
      return
    }

    const trimmedUrl = serverUrl.trim()
    if (!isValidServerUrl(trimmedUrl)) {
      return
    }

    const normalizedUrl = normalizeServerUrl(trimmedUrl)
    saveServerSelection(getLocalStorage(), { url: normalizedUrl, mode })
    onServerSelection({ url: normalizedUrl })
    setServerUrlState(normalizedUrl)
    setIsDialogOpen(false)
  }, [mode, serverUrl, onServerSelection])

  return {
    serverUrl,
    mode,
    isDialogOpen,
    isValid,
    openDialog,
    cancelDialog,
    setServerUrl,
    setMode,
    submitSelection,
  }
}
