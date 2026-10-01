import {
  readFromStorage,
  removeFromStorage,
  writeToStorage,
} from './safeStorage'

export const SERVER_URL_STORAGE_KEY = 'slim_selected_server'
export const SERVER_MODE_STORAGE_KEY = 'slim_server_selection_mode'

export type ServerSelectionMode = 'default' | 'custom'

export interface ServerSelection {
  url: string
  mode: ServerSelectionMode
}

/**
 * Custom mode only applies when a custom URL was actually stored. A URL stored
 * without any mode predates the mode key and was always applied as custom.
 */
export function parseServerSelection(
  rawUrl: string | null,
  rawMode: string | null,
): ServerSelection {
  const url = rawUrl?.trim() ?? ''
  const isCustom = rawMode === 'custom' || rawMode === null
  const mode: ServerSelectionMode =
    isCustom && url !== '' ? 'custom' : 'default'
  return { url, mode }
}

export function loadServerSelection(
  storage: Storage | undefined,
): ServerSelection {
  return parseServerSelection(
    readFromStorage(storage, SERVER_URL_STORAGE_KEY),
    readFromStorage(storage, SERVER_MODE_STORAGE_KEY),
  )
}

/**
 * Persist the mode and the custom URL. The URL is kept in default mode too,
 * so switching back to the custom server offers it again.
 */
export function saveServerSelection(
  storage: Storage | undefined,
  selection: ServerSelection,
): void {
  writeToStorage(storage, SERVER_MODE_STORAGE_KEY, selection.mode)
  if (selection.url !== '') {
    writeToStorage(storage, SERVER_URL_STORAGE_KEY, selection.url)
  } else {
    removeFromStorage(storage, SERVER_URL_STORAGE_KEY)
  }
}
