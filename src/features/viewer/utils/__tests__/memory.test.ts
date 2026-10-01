import {
  formatGigabytes,
  memoryUsageLevel,
  memoryUsagePercent,
} from '../memory'

describe('memoryUsagePercent', () => {
  it('computes the used share of the limit', () => {
    expect(memoryUsagePercent(512, 1024)).toBe(50)
  })

  it('clamps to [0, 100]', () => {
    expect(memoryUsagePercent(2048, 1024)).toBe(100)
    expect(memoryUsagePercent(-1, 1024)).toBe(0)
  })

  it('returns null when values are unknown or invalid', () => {
    expect(memoryUsagePercent(null, 1024)).toBeNull()
    expect(memoryUsagePercent(512, null)).toBeNull()
    expect(memoryUsagePercent(512, 0)).toBeNull()
    expect(memoryUsagePercent(Number.NaN, 1024)).toBeNull()
  })
})

describe('memoryUsageLevel', () => {
  it('matches the MemoryMonitor thresholds', () => {
    expect(memoryUsageLevel(null)).toBe('none')
    expect(memoryUsageLevel(75)).toBe('none')
    expect(memoryUsageLevel(80)).toBe('none')
    expect(memoryUsageLevel(80.1)).toBe('high')
    expect(memoryUsageLevel(90)).toBe('high')
    expect(memoryUsageLevel(90.1)).toBe('critical')
  })
})

describe('formatGigabytes', () => {
  it('formats bytes as GiB with one decimal', () => {
    expect(formatGigabytes(1.5 * 1024 ** 3)).toBe('1.5')
  })
})
