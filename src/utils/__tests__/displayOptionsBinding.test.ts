import type { DisplayOptionDescriptor } from '../displayOptions'
import {
  bindDisplayOptions,
  isDisplayOptionId,
  summarizeDisplayOptions,
} from '../displayOptionsBinding'

const descriptor = (
  overrides: Partial<DisplayOptionDescriptor>,
): DisplayOptionDescriptor => ({
  id: 'icc',
  label: 'ICC profiles',
  description: '',
  enabled: false,
  ...overrides,
})

describe('isDisplayOptionId', () => {
  it('accepts known ids only', () => {
    expect(isDisplayOptionId('icc')).toBe(true)
    expect(isDisplayOptionId('interpolation')).toBe(true)
    expect(isDisplayOptionId('ICC')).toBe(false)
    expect(isDisplayOptionId('')).toBe(false)
  })
})

describe('bindDisplayOptions', () => {
  const settings = { iccProfileEnabled: false, gammaEnabled: true }

  it('keeps descriptor fields', () => {
    const [option] = bindDisplayOptions(
      [descriptor({ shortLabel: 'ICC', disabled: true })],
      settings,
      { icc: 'iccProfileEnabled' },
      jest.fn(),
    )
    expect(option).toMatchObject({
      id: 'icc',
      shortLabel: 'ICC',
      disabled: true,
    })
  })

  it('replaces only the mapped flag on toggle', () => {
    const onChange = jest.fn()
    const options = bindDisplayOptions(
      [descriptor({ id: 'icc' }), descriptor({ id: 'gamma' })],
      settings,
      { icc: 'iccProfileEnabled', gamma: 'gammaEnabled' },
      onChange,
    )
    options[0].onChange(true)
    expect(onChange).toHaveBeenLastCalledWith({
      iccProfileEnabled: true,
      gammaEnabled: true,
    })
    options[1].onChange(false)
    expect(onChange).toHaveBeenLastCalledWith({
      iccProfileEnabled: false,
      gammaEnabled: false,
    })
    expect(settings).toEqual({ iccProfileEnabled: false, gammaEnabled: true })
  })

  it('ignores toggles of unmapped or unknown ids', () => {
    const onChange = jest.fn()
    const options = bindDisplayOptions(
      [descriptor({ id: 'gamma' }), descriptor({ id: 'unknown' })],
      settings,
      { icc: 'iccProfileEnabled' },
      onChange,
    )
    options[0].onChange(true)
    options[1].onChange(true)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('summarizeDisplayOptions', () => {
  it('accepts plain descriptors', () => {
    expect(
      summarizeDisplayOptions([
        descriptor({ shortLabel: 'ICC', enabled: true }),
        descriptor({ id: 'gamma', label: 'Gamma correction' }),
      ]),
    ).toBe('ICC on · Gamma correction off')
  })
})
