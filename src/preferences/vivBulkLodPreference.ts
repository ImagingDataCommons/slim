/**
 * Viv bulk-annotation LOD preference (centroids when zoomed out, full paths when
 * zoomed in). Controlled by how many pyramid levels coarser than the finest tile
 * may still show full paths.
 */
const ENABLED_KEY = 'slim_viv_bulk_lod_enabled_v1'
const LEVELS_KEY = 'slim_viv_bulk_lod_levels_from_finest_v1'
/** Legacy mm key — cleared so old Autocomplete values don't confuse users. */
const LEGACY_THRESHOLD_MM_KEY = 'slim_viv_bulk_lod_threshold_mm_v1'

/**
 * Default: paths at the finest tile and one level coarser (`tile z >= -1`).
 * Increase to show polygons earlier; set to `0` for finest tile only.
 */
export const VIV_BULK_LOD_DEFAULT_LEVELS_FROM_FINEST = 1

/** Soft UI cap; pyramids are usually far smaller. */
export const VIV_BULK_LOD_MAX_LEVELS_FROM_FINEST = 16

/** Pure read (no writes at import time); the key is persisted on explicit set. */
function readEnabled(): boolean {
  try {
    const v = window.localStorage.getItem(ENABLED_KEY)
    if (v === 'false') {
      return false
    }
  } catch {
    /* ignore */
  }
  return true
}

function readLevelsFromFinest(): number | null {
  try {
    const v = window.localStorage.getItem(LEVELS_KEY)
    if (v == null || v === '') {
      return null
    }
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0) {
      return Math.min(VIV_BULK_LOD_MAX_LEVELS_FROM_FINEST, Math.floor(n))
    }
  } catch {
    /* ignore */
  }
  return null
}

let legacyThresholdCleared = false

/** Drop the dead legacy threshold key on first explicit preference write. */
function clearLegacyThresholdMmOnce(): void {
  if (legacyThresholdCleared) {
    return
  }
  legacyThresholdCleared = true
  try {
    window.localStorage.removeItem(LEGACY_THRESHOLD_MM_KEY)
  } catch {
    /* ignore */
  }
}

let enabledCached = readEnabled()
let levelsCached = readLevelsFromFinest()
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((l) => {
    l()
  })
}

export function getVivBulkLodEnabled(): boolean {
  return enabledCached
}

export function setVivBulkLodEnabled(enabled: boolean): void {
  if (enabledCached === enabled) {
    return
  }
  enabledCached = enabled
  try {
    clearLegacyThresholdMmOnce()
    window.localStorage.setItem(ENABLED_KEY, String(enabled))
  } catch {
    /* ignore */
  }
  notify()
}

/**
 * `null` = Auto ({@link VIV_BULK_LOD_DEFAULT_LEVELS_FROM_FINEST} — finest + one level).
 */
export function getVivBulkLodLevelsFromFinest(): number | null {
  return levelsCached
}

export function setVivBulkLodLevelsFromFinest(value: number | null): void {
  const next =
    value === null
      ? null
      : Math.min(
          VIV_BULK_LOD_MAX_LEVELS_FROM_FINEST,
          Math.max(0, Math.floor(value)),
        )
  if (levelsCached === next) {
    return
  }
  if (
    next !== null &&
    (typeof next !== 'number' || !Number.isFinite(next) || next < 0)
  ) {
    return
  }
  levelsCached = next
  try {
    clearLegacyThresholdMmOnce()
    if (next === null) {
      window.localStorage.removeItem(LEVELS_KEY)
    } else {
      window.localStorage.setItem(LEVELS_KEY, String(next))
    }
  } catch {
    /* ignore */
  }
  notify()
}

/**
 * Effective levels for {@link computeVivBulkHighResolution}:
 * - LOD on + Auto → {@link VIV_BULK_LOD_DEFAULT_LEVELS_FROM_FINEST} (`1`)
 * - LOD on + custom → that non-negative integer
 */
export function resolveVivBulkLodLevelsFromFinest(): number {
  return levelsCached ?? VIV_BULK_LOD_DEFAULT_LEVELS_FROM_FINEST
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
    if (e.key !== ENABLED_KEY && e.key !== LEVELS_KEY) {
      return
    }
    enabledCached = readEnabled()
    levelsCached = readLevelsFromFinest()
    notify()
  }
  window.addEventListener('storage', storageListener)
}

export function subscribeVivBulkLodPreference(
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
