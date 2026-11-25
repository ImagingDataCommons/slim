import { InMemoryWebStorage } from 'oidc-client-ts'

import { SafeStateStore } from '../oidcStore'

describe('SafeStateStore', () => {
  it('stores values under the oidc prefix', async () => {
    const storage = new InMemoryWebStorage()
    storage.setItem('unrelated', 'x')
    const store = new SafeStateStore(storage)

    await store.set('abc', 'value')

    expect(storage.getItem('oidc.abc')).toBe('value')
    expect(await store.get('abc')).toBe('value')
    expect(await store.getAllKeys()).toEqual(['abc'])
  })

  it('returns the removed value', async () => {
    const store = new SafeStateStore(new InMemoryWebStorage())
    await store.set('abc', 'value')

    expect(await store.remove('abc')).toBe('value')
    expect(await store.get('abc')).toBeNull()
    expect(await store.remove('abc')).toBeNull()
  })

  it('does not reject when storage throws', async () => {
    const failing = new InMemoryWebStorage()
    const fail = (): never => {
      throw new Error('QuotaExceededError')
    }
    failing.setItem = fail
    failing.getItem = fail
    failing.removeItem = fail
    failing.key = fail
    const store = new SafeStateStore(failing)

    await expect(store.set('abc', 'value')).resolves.toBeUndefined()
    await expect(store.get('abc')).resolves.toBeNull()
    await expect(store.remove('abc')).resolves.toBeNull()
    await expect(store.getAllKeys()).resolves.toEqual([])
  })
})
