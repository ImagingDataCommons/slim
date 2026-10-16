/**
 * Logger utility that wraps console logging and can be configured for different environments.
 * Configured from `window.config.logger` at application startup.
 */

export enum LogLevel {
  DEBUG = 0,
  LOG = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/** Unknown names fall back to DEBUG */
export function parseLogLevel(level: string): LogLevel {
  switch (level.toUpperCase()) {
    case 'DEBUG':
      return LogLevel.DEBUG
    case 'LOG':
      return LogLevel.LOG
    case 'WARN':
      return LogLevel.WARN
    case 'ERROR':
      return LogLevel.ERROR
    case 'NONE':
      return LogLevel.NONE
    default:
      return LogLevel.DEBUG
  }
}

interface LoggerConfig {
  level: LogLevel
  enableInProduction: boolean
  enableInDevelopment: boolean
}

export class Logger {
  public config: LoggerConfig

  constructor() {
    /** `window` is absent when tests run in the node environment */
    const globalConfig =
      typeof window !== 'undefined' ? window.config?.logger : undefined
    let configLevel = 'DEBUG'
    if (globalConfig?.level != null && String(globalConfig.level) !== '') {
      configLevel = globalConfig.level as string
    } else if (import.meta.env.PROD) {
      configLevel = 'ERROR'
    }

    this.config = {
      level: parseLogLevel(configLevel),
      enableInProduction: Boolean(globalConfig?.enableInProduction),
      enableInDevelopment: globalConfig?.enableInDevelopment !== false,
    }
  }

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Check if logging is enabled for the current environment and level
   */
  private shouldLog(level: LogLevel): boolean {
    if (level < this.config.level) {
      return false
    }

    if (import.meta.env.PROD) {
      return this.config.enableInProduction
    }

    return this.config.enableInDevelopment
  }

  /**
   * Log debug messages
   */
  debug(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(...args)
    }
  }

  /**
   * Log info messages
   */
  log(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.LOG)) {
      console.log(...args)
    }
  }

  /**
   * Log warning messages
   */
  warn(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...args)
    }
  }

  /**
   * Log error messages
   */
  error(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(...args)
    }
  }
}

export const logger = new Logger()

export const debug = (...args: unknown[]): void => logger.debug(...args)
export const log = (...args: unknown[]): void => logger.log(...args)
export const warn = (...args: unknown[]): void => logger.warn(...args)
export const error = (...args: unknown[]): void => logger.error(...args)
