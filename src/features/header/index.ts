/** Header feature exports */

export { DebugDialog } from './components/dialogs/DebugDialog'
export { DicomTagBrowserDialog } from './components/dialogs/DicomTagBrowserDialog'
export { PreferencesDialog } from './components/dialogs/PreferencesDialog'
export { ServerSelectionDialog } from './components/dialogs/ServerSelectionDialog'
export { Header } from './components/Header'
export { UserMenu } from './components/UserMenu'
export type { ExtendedError } from './hooks/useNotifications'
export { useNotifications } from './hooks/useNotifications'
export { usePreferences } from './hooks/usePreferences'
export { useServerSelection } from './hooks/useServerSelection'
export {
  loadPreferences,
  savePreferences,
  type UserPreferences,
} from './utils/preferences'
export { isValidServerUrl } from './utils/serverUrl'
