import {
  changedSettingKeys,
  parseClusteringThreshold,
  resolveClusteringThreshold,
  shouldApplyClusteringSettings,
} from '../displaySettings'

describe('shouldApplyClusteringSettings', () => {
  const enabled = { isEnabled: true, thresholdInput: '' }

  it('applies when clustering is toggled, whatever the threshold', () => {
    expect(
      shouldApplyClusteringSettings(enabled, { ...enabled, isEnabled: false }),
    ).toBe(true)
    expect(
      shouldApplyClusteringSettings(
        { isEnabled: false, thresholdInput: '0.' },
        { isEnabled: true, thresholdInput: '0.' },
      ),
    ).toBe(true)
  })

  it('applies a valid threshold edit while enabled', () => {
    expect(
      shouldApplyClusteringSettings(enabled, {
        ...enabled,
        thresholdInput: '0.5',
      }),
    ).toBe(true)
  })

  it('applies toggle and threshold edits made together using the new values', () => {
    expect(
      shouldApplyClusteringSettings(
        { isEnabled: false, thresholdInput: '' },
        { isEnabled: true, thresholdInput: '0.5' },
      ),
    ).toBe(true)
  })

  it('skips partial input, edits while disabled and no-ops', () => {
    expect(
      shouldApplyClusteringSettings(enabled, {
        ...enabled,
        thresholdInput: '0.',
      }),
    ).toBe(false)
    expect(
      shouldApplyClusteringSettings(
        { isEnabled: false, thresholdInput: '' },
        { isEnabled: false, thresholdInput: '1' },
      ),
    ).toBe(false)
    expect(shouldApplyClusteringSettings(enabled, { ...enabled })).toBe(false)
  })
})

describe('parseClusteringThreshold', () => {
  it('treats empty input as automatic', () => {
    expect(parseClusteringThreshold('')).toEqual({ value: null, isValid: true })
    expect(parseClusteringThreshold('   ')).toEqual({
      value: null,
      isValid: true,
    })
  })

  it('accepts decimals', () => {
    expect(parseClusteringThreshold('0.001')).toEqual({
      value: 0.001,
      isValid: true,
    })
    expect(parseClusteringThreshold('.5')).toEqual({
      value: 0.5,
      isValid: true,
    })
    expect(parseClusteringThreshold(' 2 ')).toEqual({ value: 2, isValid: true })
  })

  it('accepts zero', () => {
    expect(parseClusteringThreshold('0')).toEqual({ value: 0, isValid: true })
  })

  it('clamps values above the maximum', () => {
    expect(parseClusteringThreshold('250')).toEqual({
      value: 100,
      isValid: true,
    })
  })

  it('rejects partial, negative and non-numeric input', () => {
    expect(parseClusteringThreshold('0.')).toEqual({
      value: null,
      isValid: false,
    })
    expect(parseClusteringThreshold('-1')).toEqual({
      value: null,
      isValid: false,
    })
    expect(parseClusteringThreshold('abc')).toEqual({
      value: null,
      isValid: false,
    })
    expect(parseClusteringThreshold('1e-3')).toEqual({
      value: null,
      isValid: false,
    })
  })
})

describe('resolveClusteringThreshold', () => {
  it('disables clustering when turned off', () => {
    expect(resolveClusteringThreshold(false, '0.5', 0.001)).toBeUndefined()
  })

  it('uses the parsed value when valid', () => {
    expect(resolveClusteringThreshold(true, '0.5', 0.001)).toBe(0.5)
  })

  it('falls back for empty or invalid input', () => {
    expect(resolveClusteringThreshold(true, '', 0.001)).toBe(0.001)
    expect(resolveClusteringThreshold(true, '-2', 0.001)).toBe(0.001)
    expect(resolveClusteringThreshold(true, '')).toBeUndefined()
  })
})

describe('changedSettingKeys', () => {
  it('lists keys whose values differ', () => {
    expect(
      changedSettingKeys(
        { iccProfileEnabled: true, gammaEnabled: false },
        { iccProfileEnabled: false, gammaEnabled: false },
      ),
    ).toEqual(['iccProfileEnabled'])
  })

  it('returns an empty list when nothing changed', () => {
    expect(changedSettingKeys({ a: 1, b: '' }, { a: 1, b: '' })).toEqual([])
  })
})
