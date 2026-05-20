import { Logger, LogLevel } from './logger'

/** Mock globalThis.config (same object as window.config in browsers). */
const mockGlobalConfig = (config: unknown): void => {
  Object.defineProperty(globalThis, 'config', {
    value: config,
    writable: true,
    configurable: true,
  })
}

describe('Logger', () => {
  beforeEach(() => {
    // Reset window.config before each test
    mockGlobalConfig(undefined)
  })

  afterEach(() => {
    delete (globalThis as { config?: unknown }).config
  })

  it('should use default config when no config is provided', () => {
    const testLogger = new Logger()
    expect(testLogger.config.level).toBe(LogLevel.DEBUG)
    expect(testLogger.config.enableInProduction).toBe(false)
    expect(testLogger.config.enableInDevelopment).toBe(true)
  })

  it('should read logger config from globalThis.config', () => {
    mockGlobalConfig({
      logger: {
        level: 'WARN',
        enableInProduction: true,
        enableInDevelopment: false
      }
    })

    const testLogger = new Logger()
    expect(testLogger.config.level).toBe(LogLevel.WARN)
    expect(testLogger.config.enableInProduction).toBe(true)
    expect(testLogger.config.enableInDevelopment).toBe(false)
  })

  it('should parse log levels correctly', () => {
    const testLogger = new Logger()

    expect(testLogger.parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG)
    expect(testLogger.parseLogLevel('LOG')).toBe(LogLevel.LOG)
    expect(testLogger.parseLogLevel('WARN')).toBe(LogLevel.WARN)
    expect(testLogger.parseLogLevel('ERROR')).toBe(LogLevel.ERROR)
    expect(testLogger.parseLogLevel('NONE')).toBe(LogLevel.NONE)
    expect(testLogger.parseLogLevel('INVALID')).toBe(LogLevel.DEBUG) // default
  })
})
