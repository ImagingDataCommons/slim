import {
  DEFAULT_PREFERENCES,
  defaultAnnotationPreferences,
  loadPreferences,
  PREFERENCES_CHANGED_EVENT,
  PREFERENCES_STORAGE_KEY,
  parsePreferences,
  savePreferences,
  withAnnotationDefaults,
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
      useFindingColors: false,
      strokeColor: '#D9453B',
      markupLabelColor: '#1F9D6B',
      markupLabelFontSize: 16,
      strokeWidth: 4,
      roiFill: false,
      roiFillOpacity: 0.55,
      confirmRoiRemoval: false,
      showOverviewMap: false,
      showViewportInfo: false,
      showSlideLabel: false,
      showZoomControls: false,
    })
    expect(parsePreferences(stored)).toEqual({
      units: 'mm',
      compactRows: true,
      useFindingColors: false,
      strokeColor: '#D9453B',
      markupLabelColor: '#1F9D6B',
      markupLabelFontSize: 16,
      strokeWidth: 4,
      roiFill: false,
      roiFillOpacity: 0.55,
      confirmRoiRemoval: false,
      showOverviewMap: false,
      showViewportInfo: false,
      showSlideLabel: false,
      showZoomControls: false,
      worklistHiddenColumnIds: [],
    })
  })

  it('keeps known worklist hidden column ids', () => {
    const stored = JSON.stringify({
      worklistHiddenColumnIds: [
        'AccessionNumber',
        'PatientName',
        'bogus',
        'StudyID',
      ],
    })
    expect(parsePreferences(stored).worklistHiddenColumnIds).toEqual([
      'AccessionNumber',
      'StudyID',
    ])
  })

  it('shows every viewport overlay by default', () => {
    expect(parsePreferences(JSON.stringify({ compactRows: true }))).toEqual(
      expect.objectContaining({
        showOverviewMap: true,
        showViewportInfo: true,
        showSlideLabel: true,
        showZoomControls: true,
      }),
    )
  })

  it('ignores mistyped and unknown fields', () => {
    const stored = JSON.stringify({
      units: 'inch',
      compactRows: 'yes',
      confirmRoiRemoval: 1,
      showOverviewMap: 'no',
      showRoiLabels: true,
      rememberFilters: false,
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

  it('keeps markup label font size within 10–24', () => {
    const parse = (markupLabelFontSize: unknown): number =>
      parsePreferences(JSON.stringify({ markupLabelFontSize }))
        .markupLabelFontSize
    expect(parse(9)).toBe(DEFAULT_PREFERENCES.markupLabelFontSize)
    expect(parse(25)).toBe(DEFAULT_PREFERENCES.markupLabelFontSize)
    expect(parse('14')).toBe(DEFAULT_PREFERENCES.markupLabelFontSize)
    expect(parse(10)).toBe(10)
    expect(parse(24)).toBe(24)
    expect(parse(13)).toBe(13)
  })

  it('keeps ROI fill opacity within 0.05–1', () => {
    const parse = (roiFillOpacity: unknown): number =>
      parsePreferences(JSON.stringify({ roiFillOpacity })).roiFillOpacity
    expect(parse(0)).toBe(DEFAULT_PREFERENCES.roiFillOpacity)
    expect(parse(1.1)).toBe(DEFAULT_PREFERENCES.roiFillOpacity)
    expect(parse('0.5')).toBe(DEFAULT_PREFERENCES.roiFillOpacity)
    expect(parse(0.05)).toBe(0.05)
    expect(parse(1)).toBe(1)
  })
})

describe('withAnnotationDefaults', () => {
  it('restores annotation fields and leaves the rest alone', () => {
    const customized = {
      ...DEFAULT_PREFERENCES,
      units: 'mm' as const,
      strokeWidth: 6,
      roiFill: false,
      compactRows: true,
      showOverviewMap: false,
      worklistHiddenColumnIds: ['StudyID'],
    }
    expect(withAnnotationDefaults(customized)).toEqual({
      ...customized,
      ...defaultAnnotationPreferences(),
    })
    expect(withAnnotationDefaults(customized).compactRows).toBe(true)
    expect(withAnnotationDefaults(customized).showOverviewMap).toBe(false)
    expect(withAnnotationDefaults(customized).worklistHiddenColumnIds).toEqual([
      'StudyID',
    ])
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
