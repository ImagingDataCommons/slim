/**
 * Pure helpers that flatten the runtime `window.config` into rows for the
 * read-only Configuration tab of the Preferences dialog.
 */

export type ConfigValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ConfigValue[]
  | { [key: string]: ConfigValue }

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
  mode: 'light',
  disableWorklist: false,
  disableAnnotationTools: false,
  enableServerSelection: false,
  enableMemoryMonitoring: true,
  preload: false,
  'servers[0].read': true,
  'servers[0].write': false,
}

const SECRET_KEY_PATTERN = /secret|password|token|clientid|apikey/i

function isSecretPath(path: string): boolean {
  const lastSegment = path.split('.').pop() ?? path
  return SECRET_KEY_PATTERN.test(lastSegment)
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

/** Replace secret-looking leaf values with {@link MASKED_VALUE}. */
export function maskConfig(value: unknown, path = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => maskConfig(item, `${path}[${index}]`))
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    Object.entries(value).forEach(([key, item]) => {
      const childPath = path === '' ? key : `${path}.${key}`
      result[key] =
        !isGroupValue(item) && isSecretPath(childPath) && item !== undefined
          ? MASKED_VALUE
          : maskConfig(item, childPath)
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
