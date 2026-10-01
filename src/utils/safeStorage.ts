/**
 * Web Storage access that never throws. Reading `window.localStorage` itself
 * throws when storage is blocked (disabled cookies, sandboxed iframes), and
 * writes throw when the quota is exceeded.
 */

export function getLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export function readFromStorage(
  storage: Storage | undefined,
  key: string,
): string | null {
  if (storage === undefined) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function writeToStorage(
  storage: Storage | undefined,
  key: string,
  value: string,
): void {
  if (storage === undefined) return
  try {
    storage.setItem(key, value)
  } catch {
    /** Quota exceeded or storage blocked: the value is simply not persisted */
  }
}

export function removeFromStorage(
  storage: Storage | undefined,
  key: string,
): void {
  if (storage === undefined) return
  try {
    storage.removeItem(key)
  } catch {
    /** Storage blocked: nothing to remove */
  }
}

export function readStorage(key: string): string | null {
  return readFromStorage(getLocalStorage(), key)
}

export function writeStorage(key: string, value: string): void {
  writeToStorage(getLocalStorage(), key, value)
}

export function removeStorage(key: string): void {
  removeFromStorage(getLocalStorage(), key)
}
