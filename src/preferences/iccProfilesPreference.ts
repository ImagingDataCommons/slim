/**
 * Shared ICC on/off preference for OpenLayers ({@link SlideViewer}) and Viv routes.
 * Persisted so the header Settings toggle and Viv stay aligned.
 * Default is on (matches {@link dmv.viewer.VolumeImageViewer} / SlideViewer).
 */
const STORAGE_KEY = 'slim_icc_profiles_enabled_v3'
const LEGACY_V2_KEY = 'slim_icc_profiles_enabled_v2'
/** Legacy key; removed when migrating to v3. */
const LEGACY_V1_KEY = 'slim_icc_profiles_enabled'

function readStored(): boolean {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'false') {
      return false
    }
    if (v === 'true') {
      return true
    }
    // v3 missing or invalid: default ICC on. Do not inherit v2/v1 false (product default).
    window.localStorage.removeItem(LEGACY_V1_KEY)
    window.localStorage.removeItem(LEGACY_V2_KEY)
    window.localStorage.setItem(STORAGE_KEY, 'true')
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
    window.localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => {
    l()
  })
}

export function subscribeIccProfilesEnabled(
  onStoreChange: () => void,
): () => void {
  listeners.add(onStoreChange)
  const onStorage = (e: StorageEvent): void => {
    if (e.key !== STORAGE_KEY) {
      return
    }
    cached = e.newValue !== 'false'
    listeners.forEach((l) => {
      l()
    })
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener('storage', onStorage)
  }
}
