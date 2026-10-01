import { getRuntimeInfo } from '../runtimeInfo'

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

describe('getRuntimeInfo', () => {
  it('reads the config name and commits from the build environment', () => {
    const info = getRuntimeInfo({
      env: {
        REACT_APP_CONFIG: 'gcp',
        REACT_APP_GIT_SHA: 'abc1234',
        REACT_APP_DMV_GIT_SHA: 'def5678',
      },
      config: { mode: 'dark' },
      userAgent: CHROME_UA,
    })

    expect(info).toMatchObject({
      config: { mode: 'dark' },
      configName: 'gcp',
      slimCommit: 'abc1234',
      dmvCommit: 'def5678',
      userAgent: CHROME_UA,
    })
    expect(info.browserLabel).toMatch(/^chrome 128/)
    expect(info.dmvVersion).toMatch(/^\d+\.\d+/)
  })

  it('falls back to the local config and an empty object', () => {
    const info = getRuntimeInfo({
      env: {},
      config: undefined,
      userAgent: 'UnknownAgent/1.0',
    })

    expect(info.configName).toBe('local')
    expect(info.config).toEqual({})
    expect(info.slimCommit).toBeUndefined()
    expect(info.browserLabel).toBe('UnknownAgent/1.0')
  })
})
