import { logger, LogLevel } from './logger'

// Mock window.config
const mockWindowConfig = (config: any): void => {
  Object.defineProperty(window, 'config', {
    value: config,
    writable: true
  })
}

describe('Logger', () => {
  beforeEach(() => {
    // Reset window.config before each test
    mockWindowConfig(undefined)
  })

  afterEach(() => {
    // Clean up
    delete (window as any).config
  })

  it('should use default config when no config is provided', () => {
    const testLogger = new (logger.constructor as any)()
    expect(testLogger.config.level).toBe(LogLevel.DEBUG)
    expect(testLogger.config.enableInProduction).toBe(false)
    expect(testLogger.config.enableInDevelopment).toBe(true)
  })

  it('should read logger config from window.config', () => {
    mockWindowConfig({
      logger: {
        level: 'WARN',
        enableInProduction: true,
        enableInDevelopment: false
      }
    })

    const testLogger = new (logger.constructor as any)()
    expect(testLogger.config.level).toBe(LogLevel.WARN)
    expect(testLogger.config.enableInProduction).toBe(true)
    expect(testLogger.config.enableInDevelopment).toBe(false)
  })

  it('should parse log levels correctly', () => {
    const testLogger = new (logger.constructor as any)()

    expect(testLogger.parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG)
    expect(testLogger.parseLogLevel('LOG')).toBe(LogLevel.LOG)
    expect(testLogger.parseLogLevel('WARN')).toBe(LogLevel.WARN)
    expect(testLogger.parseLogLevel('ERROR')).toBe(LogLevel.ERROR)
    expect(testLogger.parseLogLevel('NONE')).toBe(LogLevel.NONE)
    expect(testLogger.parseLogLevel('INVALID')).toBe(LogLevel.DEBUG) // default
  })
})
