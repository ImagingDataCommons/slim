/** Header feature exports */

export { DebugDialog } from './components/dialogs/DebugDialog'
export { DicomTagBrowserDialog } from './components/dialogs/DicomTagBrowserDialog'
export { PreferencesDialog } from './components/dialogs/PreferencesDialog'
export { ServerSelectionDialog } from './components/dialogs/ServerSelectionDialog'
export { Header } from './components/Header'
export { UserMenu } from './components/UserMenu'
export type { ExtendedError } from './hooks/useNotifications'
export {
  groupErrorsByCategory,
  useNotifications,
} from './hooks/useNotifications'
export { useServerSelection } from './hooks/useServerSelection'

export {
  extractHostname,
  isGcpDicomStorePath,
  isValidServerUrl,
  normalizeServerUrl,
  parseServerUrl,
} from './utils/serverUrl'
