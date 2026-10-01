import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  PREFERENCES_CHANGED_EVENT,
  PREFERENCES_STORAGE_KEY,
  parsePreferences,
  savePreferences,
} from '../preferences'

describe('parsePreferences', () => {
  it('returns defaults for missing or invalid JSON', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('')).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('{not json')).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns a fresh copy of the defaults', () => {
    expect(parsePreferences(null)).not.toBe(DEFAULT_PREFERENCES)
  })

  it('merges valid fields over the defaults', () => {
    const stored = JSON.stringify({
      units: 'mm',
      compactRows: true,
      rememberFilters: false,
      strokeColor: '#D9453B',
      strokeWidth: 4,
      confirmRoiRemoval: false,
    })
    expect(parsePreferences(stored)).toEqual({
      units: 'mm',
      compactRows: true,
      rememberFilters: false,
      strokeColor: '#D9453B',
      strokeWidth: 4,
      confirmRoiRemoval: false,
    })
  })

  it('ignores mistyped and unknown fields', () => {
    const stored = JSON.stringify({
      units: 'inch',
      compactRows: 'yes',
      confirmRoiRemoval: 1,
      showRoiLabels: true,
    })
    expect(parsePreferences(stored)).toEqual(DEFAULT_PREFERENCES)
  })

  it('rejects stroke colors that are not 6-digit hex values', () => {
    const parse = (strokeColor: unknown): string =>
      parsePreferences(JSON.stringify({ strokeColor })).strokeColor
    expect(parse('red')).toBe(DEFAULT_PREFERENCES.strokeColor)
    expect(parse('#fff')).toBe(DEFAULT_PREFERENCES.strokeColor)
    expect(parse('#12345g')).toBe(DEFAULT_PREFERENCES.strokeColor)
    expect(parse('url(javascript:alert(1))')).toBe(
      DEFAULT_PREFERENCES.strokeColor,
    )
    expect(parse('#1f9d6b')).toBe('#1f9d6b')
  })

  it('keeps stroke width within 1–6', () => {
    const parse = (strokeWidth: unknown): number =>
      parsePreferences(JSON.stringify({ strokeWidth })).strokeWidth
    expect(parse(0)).toBe(DEFAULT_PREFERENCES.strokeWidth)
    expect(parse(7)).toBe(DEFAULT_PREFERENCES.strokeWidth)
    expect(parse('3')).toBe(DEFAULT_PREFERENCES.strokeWidth)
    expect(parse(1)).toBe(1)
    expect(parse(6)).toBe(6)
  })
})

describe('loadPreferences / savePreferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips through localStorage', () => {
    const preferences = { ...DEFAULT_PREFERENCES, compactRows: true }
    savePreferences(preferences)
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBe(
      JSON.stringify(preferences),
    )
    expect(loadPreferences()).toEqual(preferences)
  })

  it('notifies listeners after saving', () => {
    const listener = vi.fn()
    window.addEventListener(PREFERENCES_CHANGED_EVENT, listener)
    savePreferences(DEFAULT_PREFERENCES)
    window.removeEventListener(PREFERENCES_CHANGED_EVENT, listener)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
