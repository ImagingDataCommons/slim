import { type DisplayOption, summarizeDisplayOptions } from '../DisplayOptionsPanel'

const option = (overrides: Partial<DisplayOption>): DisplayOption => ({
  id: 'id',
  label: 'Label',
  description: '',
  enabled: false,
  onChange: () => undefined,
  ...overrides,
})

describe('summarizeDisplayOptions', () => {
  it('prefers short labels and reports on/off', () => {
    expect(
      summarizeDisplayOptions([
        option({ label: 'ICC profiles', shortLabel: 'ICC', enabled: true }),
        option({ label: 'Gamma correction', shortLabel: 'Gamma' }),
      ]),
    ).toBe('ICC on · Gamma off')
  })

  it('marks disabled options as unavailable', () => {
    expect(
      summarizeDisplayOptions([
        option({ label: 'ICC', enabled: true, disabled: true }),
      ]),
    ).toBe('ICC n/a')
  })

  it('returns an empty string without options', () => {
    expect(summarizeDisplayOptions([])).toBe('')
  })
})
