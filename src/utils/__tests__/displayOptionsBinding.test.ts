import type { DisplayOptionDescriptor } from '../displayOptions'
import {
  bindDisplayOptions,
  summarizeDisplayOptions,
} from '../displayOptionsBinding'

type Id = 'icc' | 'gamma'

const descriptor = (
  overrides: Partial<DisplayOptionDescriptor<Id>>,
): DisplayOptionDescriptor<Id> => ({
  id: 'icc',
  label: 'ICC profiles',
  description: '',
  enabled: false,
  ...overrides,
})

describe('bindDisplayOptions', () => {
  const settings = { iccProfileEnabled: false, gammaEnabled: true }

  it('keeps descriptor fields', () => {
    const [option] = bindDisplayOptions(
      [descriptor({ shortLabel: 'ICC', disabled: true })],
      settings,
      { icc: 'iccProfileEnabled' },
      vi.fn(),
    )
    expect(option).toMatchObject({
      id: 'icc',
      shortLabel: 'ICC',
      disabled: true,
    })
  })

  it('builds toggles made before the next render on each other', () => {
    const onChange = vi.fn()
    const options = bindDisplayOptions(
      [descriptor({ id: 'icc' }), descriptor({ id: 'gamma' })],
      settings,
      { icc: 'iccProfileEnabled', gamma: 'gammaEnabled' },
      onChange,
    )
    options[0].onChange(true)
    expect(onChange).toHaveBeenLastCalledWith(
      { iccProfileEnabled: true, gammaEnabled: true },
      settings,
    )
    options[1].onChange(false)
    expect(onChange).toHaveBeenLastCalledWith(
      { iccProfileEnabled: true, gammaEnabled: false },
      { iccProfileEnabled: true, gammaEnabled: true },
    )
    expect(settings).toEqual({ iccProfileEnabled: false, gammaEnabled: true })
  })

  it('drops a repeated toggle that changes nothing', () => {
    const onChange = vi.fn()
    const [option] = bindDisplayOptions(
      [descriptor({ id: 'icc' })],
      settings,
      { icc: 'iccProfileEnabled' },
      onChange,
    )
    option.onChange(true)
    option.onChange(true)
    option.onChange(false)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('ignores toggles of unmapped ids', () => {
    const onChange = vi.fn()
    const [option] = bindDisplayOptions(
      [descriptor({ id: 'gamma' })],
      settings,
      { icc: 'iccProfileEnabled' },
      onChange,
    )
    option.onChange(true)
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

  it('marks disabled options as unavailable', () => {
    expect(
      summarizeDisplayOptions([descriptor({ label: 'ICC', disabled: true })]),
    ).toBe('ICC n/a')
  })
})
