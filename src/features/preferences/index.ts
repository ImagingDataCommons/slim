/** Preferences feature exports */

export {
  PreferencesDialog,
  type PreferencesTab,
} from './components/PreferencesDialog'
export { usePreferences } from './hooks/usePreferences'
export {
  loadPreferences,
  type MeasurementUnit,
  savePreferences,
  type UserPreferences,
} from './utils/preferences'
