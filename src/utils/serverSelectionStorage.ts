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

/** Custom mode only applies when a custom URL was actually stored. */
export function parseServerSelection(
  rawUrl: string | null,
  rawMode: string | null,
): ServerSelection {
  const url = rawUrl?.trim() ?? ''
  const mode: ServerSelectionMode =
    rawMode === 'custom' && url !== '' ? 'custom' : 'default'
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

/** Persist the mode; the URL is stored for custom mode and cleared otherwise. */
export function saveServerSelection(
  storage: Storage | undefined,
  selection: ServerSelection,
): void {
  writeToStorage(storage, SERVER_MODE_STORAGE_KEY, selection.mode)
  if (selection.mode === 'custom') {
    writeToStorage(storage, SERVER_URL_STORAGE_KEY, selection.url)
  } else {
    removeFromStorage(storage, SERVER_URL_STORAGE_KEY)
  }
}
