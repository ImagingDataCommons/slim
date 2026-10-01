import {
  loadServerSelection,
  parseServerSelection,
  SERVER_MODE_STORAGE_KEY,
  SERVER_URL_STORAGE_KEY,
  saveServerSelection,
} from '../serverSelectionStorage'

describe('parseServerSelection', () => {
  it('defaults to the configured server', () => {
    expect(parseServerSelection(null, null)).toEqual({
      url: '',
      mode: 'default',
    })
  })

  it('uses custom mode only when a URL is stored', () => {
    expect(parseServerSelection(' https://a.org/rs ', 'custom')).toEqual({
      url: 'https://a.org/rs',
      mode: 'custom',
    })
    expect(parseServerSelection('  ', 'custom')).toEqual({
      url: '',
      mode: 'default',
    })
    expect(parseServerSelection('https://a.org/rs', 'other')).toEqual({
      url: 'https://a.org/rs',
      mode: 'default',
    })
  })

  it('treats a URL stored without a mode as a legacy custom selection', () => {
    expect(parseServerSelection('https://a.org/rs', null)).toEqual({
      url: 'https://a.org/rs',
      mode: 'custom',
    })
  })

  it('keeps an explicit default mode even when a URL is stored', () => {
    expect(parseServerSelection('https://a.org/rs', 'default')).toEqual({
      url: 'https://a.org/rs',
      mode: 'default',
    })
  })
})

describe('loadServerSelection / saveServerSelection', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips a custom selection', () => {
    saveServerSelection(window.localStorage, {
      url: 'https://a.org/rs',
      mode: 'custom',
    })
    expect(loadServerSelection(window.localStorage)).toEqual({
      url: 'https://a.org/rs',
      mode: 'custom',
    })
  })

  it('clears the stored URL for default mode', () => {
    window.localStorage.setItem(SERVER_URL_STORAGE_KEY, 'https://a.org/rs')
    saveServerSelection(window.localStorage, { url: '', mode: 'default' })
    expect(window.localStorage.getItem(SERVER_URL_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(SERVER_MODE_STORAGE_KEY)).toBe('default')
  })

  it('falls back to defaults without storage', () => {
    expect(loadServerSelection(undefined)).toEqual({
      url: '',
      mode: 'default',
    })
  })
})
