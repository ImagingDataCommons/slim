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

  it('ignores toggles of unmapped ids', () => {
    const onChange = jest.fn()
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
