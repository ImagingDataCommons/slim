import {
  getLocalStorage,
  readFromStorage,
  readStorage,
  removeFromStorage,
  removeStorage,
  writeStorage,
  writeToStorage,
} from '../safeStorage'

function createThrowingStorage(): Storage {
  const fail = (): never => {
    throw new Error('blocked')
  }
  return {
    length: 0,
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  }
}

describe('safeStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('returns window.localStorage when available', () => {
    expect(getLocalStorage()).toBe(window.localStorage)
  })

  it('reads, writes and removes localStorage values', () => {
    writeStorage('key', 'value')
    expect(window.localStorage.getItem('key')).toBe('value')
    expect(readStorage('key')).toBe('value')
    removeStorage('key')
    expect(readStorage('key')).toBeNull()
  })

  it('uses an explicit storage', () => {
    const storage = window.sessionStorage
    writeToStorage(storage, 'explicit', '1')
    expect(readFromStorage(storage, 'explicit')).toBe('1')
    expect(readStorage('explicit')).toBeNull()
    removeFromStorage(storage, 'explicit')
    expect(readFromStorage(storage, 'explicit')).toBeNull()
  })

  it('returns null and swallows errors when storage throws', () => {
    const storage = createThrowingStorage()
    expect(readFromStorage(storage, 'key')).toBeNull()
    expect(() => writeToStorage(storage, 'key', 'value')).not.toThrow()
    expect(() => removeFromStorage(storage, 'key')).not.toThrow()
  })

  it('is a no-op without storage', () => {
    window.localStorage.setItem('key', 'value')
    expect(readFromStorage(undefined, 'key')).toBeNull()
    expect(() => writeToStorage(undefined, 'key', 'other')).not.toThrow()
    expect(() => removeFromStorage(undefined, 'key')).not.toThrow()
    expect(window.localStorage.getItem('key')).toBe('value')
  })
})
