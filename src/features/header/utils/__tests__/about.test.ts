import {
  buildSupportInfo,
  formatBrowserLabel,
  getAboutLinks,
  getDependencyVersion,
  resolveCommit,
  shortenCommit,
} from '../about'

describe('shortenCommit', () => {
  it('abbreviates hex hashes to 7 characters', () => {
    expect(shortenCommit('8dafac5e0f1b2c3d')).toBe('8dafac5')
  })

  it('keeps short or non-hex values', () => {
    expect(shortenCommit('abc123')).toBe('abc123')
    expect(shortenCommit('unknown')).toBe('unknown')
  })
})

describe('getAboutLinks', () => {
  it('adds issues and releases for GitHub repositories', () => {
    expect(
      getAboutLinks('https://github.com/ImagingDataCommons/slim/').map(
        (link) => link.href,
      ),
    ).toEqual([
      'https://github.com/ImagingDataCommons/slim',
      'https://github.com/ImagingDataCommons/slim/issues',
      'https://github.com/ImagingDataCommons/slim/releases',
    ])
  })

  it('only links the homepage elsewhere', () => {
    expect(getAboutLinks('https://example.org/slim')).toEqual([
      { label: 'Source code', href: 'https://example.org/slim', icon: 'code' },
    ])
  })
})

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
        id: 'slim-version',
        label: 'Slim version',
        value: '0.46.10',
        isCode: true,
        copyValue: '0.46.10',
      },
      {
        id: 'slim-commit',
        label: 'Slim commit',
        value: 'abc123',
        isCode: true,
        copyValue: 'abc123',
      },
      {
        id: 'dmv-version',
        label: 'DICOM Microscopy Viewer',
        value: '0.48.26',
        isCode: true,
        copyValue: '0.48.26',
      },
      {
        id: 'dmv-commit',
        label: 'DICOM Microscopy Viewer commit',
        value: 'Not available in this build',
        isCode: false,
        isMissing: true,
      },
      {
        id: 'browser',
        label: 'Browser & OS',
        value: 'chrome 128 · Mac OS',
        isCode: false,
      },
    ])
  })

  it('abbreviates full commit hashes but copies the full value', () => {
    const sha = '8dafac5e0f1b2c3d4e5f60718293a4b5c6d7e8f9'
    const commitRow = buildSupportInfo({ ...input, slimCommit: sha }).rows[1]
    expect(commitRow.value).toBe('8dafac5')
    expect(commitRow.copyValue).toBe(sha)
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
