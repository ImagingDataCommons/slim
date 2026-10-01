/**
 * Pure helpers that flatten the runtime `window.config` into rows for the
 * read-only Configuration tab of the Preferences dialog.
 */

export interface ConfigRow {
  /** Dotted path, e.g. `servers[0].url` */
  path: string
  /** Last path segment shown in the tree */
  key: string
  depth: number
  isGroup: boolean
  /** Formatted leaf value (strings quoted, arrays inline) */
  value: string
  raw: unknown
  /** Leaf differs from Slim's built-in default (or has no known default) */
  isChanged: boolean
}

export const MASKED_VALUE = '••••••••'

/** Slim defaults for config keys that have one, keyed by dotted path. */
export const CONFIG_DEFAULTS: Record<string, unknown> = {
  path: '/',
  mode: 'dark',
  disableWorklist: false,
  disableAnnotationTools: false,
  enableServerSelection: false,
  enableMemoryMonitoring: true,
  preload: false,
  'servers[0].read': true,
  'servers[0].write': false,
}

const SECRET_KEY_PATTERN =
  /(secret|token|password|passwd|authorization|bearer|credential|api[-_]?key|private[-_]?key|client[-_]?secret)/i

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isGroupValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => item !== null && typeof item === 'object')
  }
  return isPlainObject(value)
}

export function formatConfigValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatConfigValue(item)).join(', ')}]`
  }
  if (typeof value === 'function') return 'ƒ()'
  return String(value)
}

/** Config as a `window.config = …` script, with functions shown as `ƒ()`. */
export function formatConfigScript(config: unknown): string {
  const json = JSON.stringify(
    config,
    (_key, value: unknown) =>
      typeof value === 'function' ? formatConfigValue(value) : value,
    2,
  )
  return `window.config = ${json}`
}

/** Number of leaves that differ from their default. */
export function countChangedRows(rows: readonly ConfigRow[]): number {
  return rows.filter((row) => !row.isGroup && row.isChanged).length
}

/** Replace every defined leaf, keeping the shape of objects and arrays. */
function maskAll(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskAll)
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    Object.entries(value).forEach(([key, item]) => {
      result[key] = maskAll(item)
    })
    return result
  }
  return value === undefined ? undefined : MASKED_VALUE
}

/**
 * Replace values under secret-looking keys with {@link MASKED_VALUE},
 * including every leaf of a nested object or array under such a key.
 */
export function maskConfig(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => maskConfig(item))
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    Object.entries(value).forEach(([key, item]) => {
      if (!isSecretKey(key)) {
        result[key] = maskConfig(item)
      } else if (isGroupValue(item)) {
        result[key] = maskAll(item)
      } else {
        result[key] = item === undefined ? undefined : MASKED_VALUE
      }
    })
    return result
  }
  return value
}

/** Depth-first flatten of a config object into group and leaf rows. */
export function flattenConfig(
  config: unknown,
  defaults: Record<string, unknown> = CONFIG_DEFAULTS,
): ConfigRow[] {
  const rows: ConfigRow[] = []
  const walk = (node: unknown, path: string, depth: number): void => {
    const entries: Array<[string, unknown]> = Array.isArray(node)
      ? node.map((item, index) => [String(index), item])
      : isPlainObject(node)
        ? Object.entries(node)
        : []
    entries.forEach(([key, value]) => {
      const isIndex = Array.isArray(node)
      const childPath = isIndex
        ? `${path}[${key}]`
        : path === ''
          ? key
          : `${path}.${key}`
      const label = isIndex ? `[${key}]` : key
      if (isGroupValue(value)) {
        rows.push({
          path: childPath,
          key: label,
          depth,
          isGroup: true,
          value: '',
          raw: value,
          isChanged: false,
        })
        walk(value, childPath, depth + 1)
        return
      }
      const hasDefault = Object.hasOwn(defaults, childPath)
      const isDefault =
        hasDefault &&
        JSON.stringify(defaults[childPath]) === JSON.stringify(value)
      rows.push({
        path: childPath,
        key: label,
        depth,
        isGroup: false,
        value: formatConfigValue(value),
        raw: value,
        isChanged: !isDefault,
      })
    })
  }
  walk(config, '', 0)
  return rows
}

export interface TextSegment {
  text: string
  isMatch: boolean
  /** Offset of the segment in the original text (unique per segment) */
  start: number
}

/** Split `text` around case-insensitive occurrences of `query`. */
export function splitByQuery(text: string, query: string): TextSegment[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [{ text, isMatch: false, start: 0 }]
  const haystack = text.toLowerCase()
  const segments: TextSegment[] = []
  let start = 0
  let index = haystack.indexOf(needle, start)
  while (index !== -1) {
    if (index > start) {
      segments.push({ text: text.slice(start, index), isMatch: false, start })
    }
    segments.push({
      text: text.slice(index, index + needle.length),
      isMatch: true,
      start: index,
    })
    start = index + needle.length
    index = haystack.indexOf(needle, start)
  }
  if (start < text.length) {
    segments.push({ text: text.slice(start), isMatch: false, start })
  }
  return segments
}

/**
 * Keep leaves matching the query (and the changed filter) plus any group
 * that still has a visible descendant.
 */
export function filterConfigRows(
  rows: ConfigRow[],
  query: string,
  onlyChanged: boolean,
): ConfigRow[] {
  const normalized = query.trim().toLowerCase()
  const leafMatches = (row: ConfigRow): boolean =>
    (!onlyChanged || row.isChanged) &&
    (normalized === '' ||
      `${row.path} ${row.value}`.toLowerCase().includes(normalized))
  return rows.filter((row) =>
    row.isGroup
      ? rows.some(
          (other) =>
            !other.isGroup &&
            (other.path.startsWith(`${row.path}.`) ||
              other.path.startsWith(`${row.path}[`)) &&
            leafMatches(other),
        )
      : leafMatches(row),
  )
}
