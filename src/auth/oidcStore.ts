import { InMemoryWebStorage, type StateStore } from 'oidc-client-ts'

import {
  getLocalStorage,
  getSessionStorage,
  readFromStorage,
  removeFromStorage,
  writeToStorage,
} from '../utils/safeStorage'

const OIDC_KEY_PREFIX = 'oidc.'

const listKeys = (storage: Storage): string[] => {
  const keys: string[] = []
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key !== null) {
        keys.push(key)
      }
    }
  } catch {
    /** Storage blocked mid-iteration: report what was read */
  }
  return keys
}

/**
 * oidc-client-ts store backed by Web Storage that never throws. The library's
 * own `WebStorageStateStore` lets quota and access errors escape, which would
 * turn a full or blocked storage into a failed sign-in.
 */
export class SafeStateStore implements StateStore {
  private readonly storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  set(key: string, value: string): Promise<void> {
    writeToStorage(this.storage, OIDC_KEY_PREFIX + key, value)
    return Promise.resolve()
  }

  /** `InMemoryWebStorage` answers a missing key with undefined, not null */
  private read(prefixedKey: string): string | null {
    return readFromStorage(this.storage, prefixedKey) ?? null
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.read(OIDC_KEY_PREFIX + key))
  }

  remove(key: string): Promise<string | null> {
    const prefixedKey = OIDC_KEY_PREFIX + key
    const value = this.read(prefixedKey)
    removeFromStorage(this.storage, prefixedKey)
    return Promise.resolve(value)
  }

  getAllKeys(): Promise<string[]> {
    return Promise.resolve(
      listKeys(this.storage)
        .filter((key) => key.startsWith(OIDC_KEY_PREFIX))
        .map((key) => key.slice(OIDC_KEY_PREFIX.length)),
    )
  }
}

export interface OidcStores {
  /** Pending sign-in requests; must outlive the redirect to the provider */
  stateStore: StateStore
  /** The signed-in user; scoped to the browser tab */
  userStore: StateStore
}

/**
 * Same split as the library defaults: requests in localStorage, the user in
 * sessionStorage. Blocked storage falls back to memory so the app still loads,
 * though a redirect sign-in cannot complete without persistent state.
 */
export const createOidcStores = (): OidcStores => ({
  stateStore: new SafeStateStore(getLocalStorage() ?? new InMemoryWebStorage()),
  userStore: new SafeStateStore(
    getSessionStorage() ?? new InMemoryWebStorage(),
  ),
})
