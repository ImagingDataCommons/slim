import {
  buildSupportInfo,
  formatBrowserLabel,
  getDependencyVersion,
  resolveCommit,
} from '../about'

describe('resolveCommit', () => {
  it('falls back to "unknown" for missing commits', () => {
    expect(resolveCommit(undefined)).toBe('unknown')
    expect(resolveCommit('')).toBe('unknown')
    expect(resolveCommit('  ')).toBe('unknown')
  })

  it('returns the trimmed commit', () => {
    expect(resolveCommit(' abc123 ')).toBe('abc123')
  })
})

describe('getDependencyVersion', () => {
  it('strips range prefixes', () => {
    expect(
      getDependencyVersion(
        { dependencies: { 'dicom-microscopy-viewer': '^0.48.26' } },
        'dicom-microscopy-viewer',
      ),
    ).toBe('0.48.26')
  })

  it('falls back to devDependencies', () => {
    expect(
      getDependencyVersion({ devDependencies: { dmv: '~1.2.3' } }, 'dmv'),
    ).toBe('1.2.3')
  })

  it('returns "unknown" when missing or not a version', () => {
    expect(getDependencyVersion({}, 'dmv')).toBe('unknown')
    expect(
      getDependencyVersion({ dependencies: { dmv: 'github:org/dmv' } }, 'dmv'),
    ).toBe('unknown')
  })
})

describe('formatBrowserLabel', () => {
  it('joins name, version and OS', () => {
    expect(
      formatBrowserLabel(
        { name: 'chrome', version: '128.0.0', os: 'Mac OS' },
        'UA',
      ),
    ).toBe('chrome 128.0.0 · Mac OS')
  })

  it('omits missing parts', () => {
    expect(
      formatBrowserLabel({ name: 'firefox', version: null, os: null }, 'UA'),
    ).toBe('firefox')
  })

  it('falls back to the user agent', () => {
    expect(formatBrowserLabel(null, 'UA')).toBe('UA')
    expect(formatBrowserLabel({ name: '', version: null, os: null }, 'UA')).toBe(
      'UA',
    )
  })
})

describe('buildSupportInfo', () => {
  const input = {
    appName: 'slim',
    appVersion: '0.46.10',
    slimCommit: 'abc123',
    dmvVersion: '0.48.26',
    dmvCommit: undefined,
    browserLabel: 'chrome 128 · Mac OS',
    userAgent: 'Mozilla/5.0',
  }

  it('builds the About rows', () => {
    expect(buildSupportInfo(input).rows).toEqual([
      {
        id: 'slim',
        title: 'Slim commit',
        meta: 'Version 0.46.10',
        hash: 'abc123',
      },
      {
        id: 'dmv',
        title: 'DICOM Microscopy Viewer',
        meta: 'Version 0.48.26',
        hash: 'unknown',
      },
      { id: 'browser', title: 'Browser & OS', meta: 'chrome 128 · Mac OS' },
    ])
  })

  it('builds the support ticket text', () => {
    expect(buildSupportInfo(input).supportText).toBe(
      [
        'slim 0.46.10',
        'Slim commit: abc123',
        'DICOM Microscopy Viewer 0.48.26: unknown',
        'Browser & OS: chrome 128 · Mac OS',
        'User agent: Mozilla/5.0',
      ].join('\n'),
    )
  })
})
