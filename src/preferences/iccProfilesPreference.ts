/**
 * Shared ICC on/off preference for OpenLayers ({@link SlideViewer}) and Viv routes.
 * Persisted so the header Settings toggle and Viv stay aligned.
 * Default is on (matches {@link dmv.viewer.VolumeImageViewer} / SlideViewer).
 */
const STORAGE_KEY = 'slim_icc_profiles_enabled_v3'
const LEGACY_V2_KEY = 'slim_icc_profiles_enabled_v2'
/** Legacy key; removed when migrating to v3. */
const LEGACY_V1_KEY = 'slim_icc_profiles_enabled'

/**
 * Pure read (no writes at import time). v3 supersedes legacy keys: when v3 is
 * missing or invalid, legacy v1/v2 values are ignored and the default (on)
 * applies; legacy keys are cleaned up and v3 persisted only on the first
 * explicit {@link setIccProfilesEnabled} call.
 */
function readStored(): boolean {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'false') {
      return false
    }
    return true
  } catch {
    /* ignore */
  }
  return true
}

let cached = readStored()
const listeners = new Set<() => void>()

export function getIccProfilesEnabled(): boolean {
  return cached
}

export function setIccProfilesEnabled(enabled: boolean): void {
  if (cached === enabled) {
    return
  }
  cached = enabled
  try {
    window.localStorage.removeItem(LEGACY_V1_KEY)
    window.localStorage.removeItem(LEGACY_V2_KEY)
    window.localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => {
    l()
  })
}

/**
 * One shared `storage` listener for all subscribers (added on first subscribe,
 * removed with the last one) so N subscribers get one notification per event.
 */
let storageListener: ((e: StorageEvent) => void) | null = null

function ensureStorageListener(): void {
  if (storageListener !== null) {
    return
  }
  storageListener = (e: StorageEvent): void => {
    if (e.key !== STORAGE_KEY) {
      return
    }
    cached = e.newValue !== 'false'
    listeners.forEach((l) => {
      l()
    })
  }
  window.addEventListener('storage', storageListener)
}

export function subscribeIccProfilesEnabled(
  onStoreChange: () => void,
): () => void {
  listeners.add(onStoreChange)
  ensureStorageListener()
  return () => {
    listeners.delete(onStoreChange)
    if (listeners.size === 0 && storageListener !== null) {
      window.removeEventListener('storage', storageListener)
      storageListener = null
    }
  }
}
