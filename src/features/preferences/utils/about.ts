/** Pure builders for the About tab and its "copy for support ticket" text. */

import type { IconName } from '../../../components/ui/icon'

export interface AboutRow {
  id: string
  label: string
  value: string
  /** Render the value in a monospace font (versions, hashes) */
  isCode: boolean
  /** Full value to copy; absent when there is nothing useful to copy */
  copyValue?: string
  /** The value is a placeholder for information this build does not have */
  isMissing?: boolean
}

export interface AboutLink {
  label: string
  href: string
  icon: IconName
}

export const UNKNOWN_COMMIT = 'unknown'

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
  return value !== undefined && value.trim() !== ''
    ? value.trim()
    : UNKNOWN_COMMIT
}

/** Git-style 7 character abbreviation of a commit hash. */
export function shortenCommit(commit: string): string {
  return /^[0-9a-f]{8,}$/i.test(commit) ? commit.slice(0, 7) : commit
}

function commitRow(id: string, label: string, commit: string): AboutRow {
  if (commit === UNKNOWN_COMMIT) {
    return {
      id,
      label,
      value: 'Not available in this build',
      isCode: false,
      isMissing: true,
    }
  }
  return {
    id,
    label,
    value: shortenCommit(commit),
    isCode: true,
    copyValue: commit,
  }
}

/** Repository and issue tracker links for a GitHub homepage. */
export function getAboutLinks(homepage: string): AboutLink[] {
  const repository = homepage.replace(/\/+$/, '')
  const links: AboutLink[] = [
    { label: 'Source code', href: repository, icon: 'code' },
  ]
  if (/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+$/i.test(repository)) {
    links.push({
      label: 'Report an issue',
      href: `${repository}/issues`,
      icon: 'bug_report',
    })
    links.push({
      label: 'Releases',
      href: `${repository}/releases`,
      icon: 'new_releases',
    })
  }
  return links
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
      id: 'slim-version',
      label: 'Slim version',
      value: input.appVersion,
      isCode: true,
      copyValue: input.appVersion,
    },
    commitRow('slim-commit', 'Slim commit', slimCommit),
    {
      id: 'dmv-version',
      label: 'DICOM Microscopy Viewer',
      value: input.dmvVersion,
      isCode: true,
      copyValue: input.dmvVersion,
    },
    commitRow('dmv-commit', 'DICOM Microscopy Viewer commit', dmvCommit),
    {
      id: 'browser',
      label: 'Browser & OS',
      value: input.browserLabel,
      isCode: false,
    },
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
