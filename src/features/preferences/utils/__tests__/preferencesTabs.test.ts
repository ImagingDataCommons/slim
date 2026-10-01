import { ALL_TABS, getTabDefinition, getTabForKey } from '../preferencesTabs'

describe('getTabDefinition', () => {
  it('returns the definition of a tab', () => {
    expect(getTabDefinition('config')).toMatchObject({
      label: 'Configuration',
      isEditable: false,
    })
    expect(getTabDefinition('keys').isEditable).toBe(true)
  })
})

describe('getTabForKey', () => {
  it('moves down and up, wrapping around', () => {
    expect(getTabForKey(ALL_TABS, 'general', 'ArrowDown')).toBe('annotations')
    expect(getTabForKey(ALL_TABS, 'about', 'ArrowDown')).toBe('general')
    expect(getTabForKey(ALL_TABS, 'general', 'ArrowUp')).toBe('about')
    expect(getTabForKey(ALL_TABS, 'config', 'ArrowUp')).toBe('keys')
  })

  it('jumps to the first and last tab', () => {
    expect(getTabForKey(ALL_TABS, 'keys', 'Home')).toBe('general')
    expect(getTabForKey(ALL_TABS, 'keys', 'End')).toBe('about')
  })

  it('ignores other keys and unknown tabs', () => {
    expect(getTabForKey(ALL_TABS, 'keys', 'ArrowRight')).toBeUndefined()
    expect(getTabForKey([], 'keys', 'ArrowDown')).toBeUndefined()
  })
})
