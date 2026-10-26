import type AppConfig from '../../AppConfig'
import { Logger, LogLevel, parseLogLevel } from '../logger'

const setWindowConfig = (config: Partial<AppConfig> | undefined): void => {
  Object.defineProperty(window, 'config', {
    value: config,
    writable: true,
    configurable: true,
  })
}

describe('Logger', () => {
  beforeEach(() => {
    setWindowConfig(undefined)
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'config')
  })

  it('should use default config when no config is provided', () => {
    const testLogger = new Logger()
    expect(testLogger.config.level).toBe(LogLevel.DEBUG)
    expect(testLogger.config.enableInProduction).toBe(false)
    expect(testLogger.config.enableInDevelopment).toBe(true)
  })

  it('should read logger config from window.config', () => {
    setWindowConfig({
      logger: {
        level: 'WARN',
        enableInProduction: true,
        enableInDevelopment: false,
      },
    })

    const testLogger = new Logger()
    expect(testLogger.config.level).toBe(LogLevel.WARN)
    expect(testLogger.config.enableInProduction).toBe(true)
    expect(testLogger.config.enableInDevelopment).toBe(false)
  })

  it('should parse log levels correctly', () => {
    expect(parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG)
    expect(parseLogLevel('LOG')).toBe(LogLevel.LOG)
    expect(parseLogLevel('WARN')).toBe(LogLevel.WARN)
    expect(parseLogLevel('ERROR')).toBe(LogLevel.ERROR)
    expect(parseLogLevel('NONE')).toBe(LogLevel.NONE)
  })

  it('should fall back to DEBUG for unknown levels', () => {
    expect(parseLogLevel('INVALID')).toBe(LogLevel.DEBUG)
  })
})
