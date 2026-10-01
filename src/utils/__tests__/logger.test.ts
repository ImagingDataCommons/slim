import type AppConfig from '../../AppConfig'
import { Logger, LogLevel } from '../logger'

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
    const testLogger = new Logger()

    expect(testLogger.parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG)
    expect(testLogger.parseLogLevel('LOG')).toBe(LogLevel.LOG)
    expect(testLogger.parseLogLevel('WARN')).toBe(LogLevel.WARN)
    expect(testLogger.parseLogLevel('ERROR')).toBe(LogLevel.ERROR)
    expect(testLogger.parseLogLevel('NONE')).toBe(LogLevel.NONE)
  })

  it('should fall back to DEBUG for unknown levels', () => {
    expect(new Logger().parseLogLevel('INVALID')).toBe(LogLevel.DEBUG)
  })
})
