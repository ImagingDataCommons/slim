import {
  evaluateMemoryWarning,
  formatBytes,
  INITIAL_MEMORY_WARNING_STATE,
  type MemoryUsageFlags,
  type MemoryWarningInput,
  memoryWarningLevel,
} from '../memoryWarning'

const high: MemoryWarningInput = {
  level: 'high',
  usagePercentage: 82.34,
  remaining: '700 MB',
}
const critical: MemoryWarningInput = {
  level: 'critical',
  usagePercentage: 95.06,
  remaining: '120 MB',
}
const none: MemoryWarningInput = {
  level: 'none',
  usagePercentage: 40,
  remaining: '3 GB',
}

describe('evaluateMemoryWarning', () => {
  it('stays silent while the level is unchanged', () => {
    const decision = evaluateMemoryWarning(
      none,
      INITIAL_MEMORY_WARNING_STATE,
      0,
    )
    expect(decision.message).toBeNull()
    expect(decision.state).toBe(INITIAL_MEMORY_WARNING_STATE)
  })

  it('warns when usage becomes high', () => {
    const decision = evaluateMemoryWarning(
      high,
      INITIAL_MEMORY_WARNING_STATE,
      0,
    )
    expect(decision.message).toBe(
      'High memory usage: 82.3% used. 700 MB remaining.',
    )
    expect(decision.state.level).toBe('high')
  })

  it('warns once per level change', () => {
    const first = evaluateMemoryWarning(high, INITIAL_MEMORY_WARNING_STATE, 0)
    const second = evaluateMemoryWarning(high, first.state, 1000)
    expect(second.message).toBeNull()
  })

  it('warns and records the time when usage becomes critical', () => {
    const decision = evaluateMemoryWarning(
      critical,
      INITIAL_MEMORY_WARNING_STATE,
      5000,
    )
    expect(decision.message).toBe(
      'Critical memory usage: 95.1% used. Only 120 MB remaining. ' +
        'Consider refreshing the page or closing other tabs.',
    )
    expect(decision.state).toEqual({ level: 'critical', lastCriticalAt: 5000 })
  })

  it('throttles repeated critical warnings', () => {
    const first = evaluateMemoryWarning(
      critical,
      INITIAL_MEMORY_WARNING_STATE,
      0,
    )
    const backToHigh = evaluateMemoryWarning(high, first.state, 1000)
    const throttled = evaluateMemoryWarning(critical, backToHigh.state, 2000)
    expect(throttled.message).toBeNull()
    expect(throttled.state).toEqual({ level: 'critical', lastCriticalAt: 0 })

    const calm = evaluateMemoryWarning(none, throttled.state, 3000)
    const later = evaluateMemoryWarning(critical, calm.state, 30000)
    expect(later.message).not.toBeNull()
    expect(later.state.lastCriticalAt).toBe(30000)
  })

  it('tracks the level but stays silent without a usage percentage', () => {
    const decision = evaluateMemoryWarning(
      { ...high, usagePercentage: null },
      INITIAL_MEMORY_WARNING_STATE,
      0,
    )
    expect(decision.message).toBeNull()
    expect(decision.state.level).toBe('high')
  })

  it('stays silent when usage drops back to normal', () => {
    const first = evaluateMemoryWarning(high, INITIAL_MEMORY_WARNING_STATE, 0)
    const decision = evaluateMemoryWarning(none, first.state, 1000)
    expect(decision.message).toBeNull()
    expect(decision.state.level).toBe('none')
  })
})

describe('memoryWarningLevel', () => {
  const flags = (overrides: Partial<MemoryUsageFlags>): MemoryUsageFlags => ({
    apiMethod: 'chrome',
    isHighUsage: false,
    isCriticalUsage: false,
    ...overrides,
  })

  it('is none without a measurement or a memory API', () => {
    expect(memoryWarningLevel(null)).toBe('none')
    expect(
      memoryWarningLevel(
        flags({ apiMethod: 'unavailable', isCriticalUsage: true }),
      ),
    ).toBe('none')
  })

  it('prefers critical over high', () => {
    expect(
      memoryWarningLevel(flags({ isHighUsage: true, isCriticalUsage: true })),
    ).toBe('critical')
    expect(memoryWarningLevel(flags({ isHighUsage: true }))).toBe('high')
    expect(memoryWarningLevel(flags({}))).toBe('none')
  })
})

describe('formatBytes', () => {
  it('handles missing and zero values', () => {
    expect(formatBytes(null)).toBe('N/A')
    expect(formatBytes(0)).toBe('0 Bytes')
  })

  it('uses 1024-based units with two decimals', () => {
    expect(formatBytes(512)).toBe('512.00 Bytes')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.00 GB')
  })

  it('caps the unit at terabytes', () => {
    expect(formatBytes(2 * 1024 ** 5)).toBe('2048.00 TB')
  })
})
