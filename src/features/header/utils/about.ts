/** Pure builders for the About tab and its "copy for support ticket" text. */

export interface AboutRow {
  id: string
  title: string
  meta: string
  hash?: string
}

export interface SupportInfoInput {
  appName: string
  appVersion: string
  slimCommit?: string
  dmvVersion: string
  dmvCommit?: string
  browserLabel: string
  userAgent: string
}

export interface SupportInfo {
  rows: AboutRow[]
  supportText: string
}

interface PackageJsonLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

interface BrowserLike {
  name?: string | null
  version?: string | null
  os?: string | null
}

export function resolveCommit(value: string | undefined): string {
  return value !== undefined && value.trim() !== '' ? value.trim() : 'unknown'
}

/** Declared dependency version without its range prefix, e.g. "^0.48.2" → "0.48.2". */
export function getDependencyVersion(
  packageJson: PackageJsonLike,
  name: string,
): string {
  const declared =
    packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name]
  if (declared === undefined) return 'unknown'
  const version = declared.replace(/^[^0-9]*/, '')
  return version !== '' ? version : 'unknown'
}

/** "chrome 128.0 · Mac OS", falling back to the raw user agent. */
export function formatBrowserLabel(
  browser: BrowserLike | null,
  userAgent: string,
): string {
  if (browser === null) return userAgent
  const label = [
    `${browser.name ?? ''} ${browser.version ?? ''}`.trim(),
    browser.os ?? '',
  ]
    .filter((part) => part !== '')
    .join(' · ')
  return label !== '' ? label : userAgent
}

export function buildSupportInfo(input: SupportInfoInput): SupportInfo {
  const slimCommit = resolveCommit(input.slimCommit)
  const dmvCommit = resolveCommit(input.dmvCommit)
  const rows: AboutRow[] = [
    {
      id: 'slim',
      title: 'Slim commit',
      meta: `Version ${input.appVersion}`,
      hash: slimCommit,
    },
    {
      id: 'dmv',
      title: 'DICOM Microscopy Viewer',
      meta: `Version ${input.dmvVersion}`,
      hash: dmvCommit,
    },
    { id: 'browser', title: 'Browser & OS', meta: input.browserLabel },
  ]
  const supportText = [
    `${input.appName} ${input.appVersion}`,
    `Slim commit: ${slimCommit}`,
    `DICOM Microscopy Viewer ${input.dmvVersion}: ${dmvCommit}`,
    `Browser & OS: ${input.browserLabel}`,
    `User agent: ${input.userAgent}`,
  ].join('\n')
  return { rows, supportText }
}
