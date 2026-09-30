import { useCallback, useState } from 'react'

import { isValidServerUrl, normalizeServerUrl } from '../utils/serverUrl'

const STORAGE_KEY_URL = 'slim_selected_server'
const STORAGE_KEY_MODE = 'slim_server_selection_mode'

export type ServerSelectionMode = 'default' | 'custom'

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
  /** Load initial state from localStorage */
  const [serverUrl, setServerUrlState] = useState<string>(() => {
    const cached = localStorage.getItem(STORAGE_KEY_URL)?.trim() ?? ''
    return cached
  })

  const [mode, setModeState] = useState<ServerSelectionMode>(() => {
    const cachedUrl = localStorage.getItem(STORAGE_KEY_URL)?.trim() ?? ''
    const cachedMode = localStorage.getItem(
      STORAGE_KEY_MODE,
    ) as ServerSelectionMode | null
    if (cachedMode === 'custom' && cachedUrl !== '') {
      return 'custom'
    }
    return 'default'
  })

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
    localStorage.setItem(STORAGE_KEY_MODE, mode)

    if (mode === 'default') {
      localStorage.removeItem(STORAGE_KEY_URL)
      onServerSelection({ url: '' })
      setIsDialogOpen(false)
      return
    }

    /** Custom mode */
    const trimmedUrl = serverUrl.trim()
    if (!isValidServerUrl(trimmedUrl)) {
      return
    }

    const normalizedUrl = normalizeServerUrl(trimmedUrl)
    localStorage.setItem(STORAGE_KEY_URL, normalizedUrl)
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
