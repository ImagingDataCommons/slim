/**
 * Splits the semantic-release changelog (docs/CHANGELOG.md) into one entry per
 * version. Pure so it can run in the content loader and in node --test.
 */

export interface ChangelogEntry {
  version: string
  /** ISO date (YYYY-MM-DD) from the heading */
  date: string
  compareUrl: string | null
  /** Markdown below the heading, without the heading itself */
  body: string
  /** x.y.0 releases; semantic-release writes these as `#` headings */
  isMinor: boolean
  featureCount: number
  fixCount: number
}

const HEADING =
  /^#{1,2} \[(?<version>\d+\.\d+\.\d+[\w.-]*)\](?:\((?<url>[^)]+)\))? \((?<date>\d{4}-\d{2}-\d{2})\)\s*$/

function countBullets(body: string, sectionTitle: string): number {
  const start = body.indexOf(`### ${sectionTitle}`)
  if (start === -1) return 0
  const rest = body.slice(start + sectionTitle.length + 4)
  const next = rest.search(/^### /m)
  const section = next === -1 ? rest : rest.slice(0, next)
  return section.split('\n').filter((line) => /^\* /.test(line)).length
}

/** Entries newest first; repeated versions keep their first occurrence */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const lines = markdown.split('\n')
  const entries: ChangelogEntry[] = []
  const seen = new Set<string>()

  let current: {
    version: string
    date: string
    url: string | null
    lines: string[]
  } | null = null

  const flush = (): void => {
    if (current === null || seen.has(current.version)) return
    seen.add(current.version)
    const body = current.lines.join('\n').trim()
    entries.push({
      version: current.version,
      date: current.date,
      compareUrl: current.url,
      body,
      isMinor: /\.0$/.test(current.version),
      featureCount: countBullets(body, 'Features'),
      fixCount: countBullets(body, 'Bug Fixes'),
    })
  }

  for (const line of lines) {
    const match = HEADING.exec(line)
    if (match?.groups) {
      flush()
      current = {
        version: match.groups.version,
        date: match.groups.date,
        url: match.groups.url ?? null,
        lines: [],
      }
    } else if (current !== null) {
      current.lines.push(line)
    }
  }
  flush()

  return entries
}

/** Sorts versions newest first; several patch releases can share a date */
export function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const pb = b.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * semantic-release writes sections as `###` under a `#`/`##` version heading.
 * Release pages render the version as the h1, so sections move up one level.
 */
export function promoteSectionHeadings(body: string): string {
  return body.replace(/^#(#{2,5}) /gm, '$1 ')
}

/** First bullet of the entry with links and commit hashes removed, for list previews */
export function summarizeEntry(entry: Pick<ChangelogEntry, 'body'>): string {
  const bullet = entry.body.split('\n').find((line) => line.startsWith('* '))
  if (!bullet) return ''
  return bullet
    .slice(2)
    .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+):\*\*\s*/, '$1: ')
    .trim()
}
