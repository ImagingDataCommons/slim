/** Pure grouping and plain-text formatting for the Debug dialog. */

export type DebugCategoryKey =
  | 'Communication'
  | 'EncodingDecoding'
  | 'Visualization'
  | 'Authentication'
  | 'Warning'

export interface DebugCategory {
  key: DebugCategoryKey
  name: string
  icon: string
  isWarning?: boolean
}

export interface DebugMessage {
  message: string
  source?: string
}

export type DebugMessages = Record<DebugCategoryKey, DebugMessage[]>

/** Display order of the categories in the dialog and the copied report. */
export const DEBUG_CATEGORIES: DebugCategory[] = [
  { key: 'Communication', name: 'Communication', icon: 'wifi_off' },
  {
    key: 'EncodingDecoding',
    name: 'Data encoding/decoding',
    icon: 'data_object',
  },
  { key: 'Visualization', name: 'Visualization', icon: 'hide_image' },
  { key: 'Authentication', name: 'Authentication', icon: 'lock' },
  { key: 'Warning', name: 'Warning', icon: 'warning', isWarning: true },
]

const ERROR_CATEGORY_KEYS: ReadonlySet<string> = new Set([
  'Communication',
  'EncodingDecoding',
  'Visualization',
  'Authentication',
])

/**
 * Bucket errors by their parallel `errorCategories` entry; errors with an
 * unknown category are dropped.
 */
export function buildDebugMessages(
  errors: ReadonlyArray<{ message: string; source?: string }>,
  errorCategories: readonly string[],
  warnings: readonly string[],
): DebugMessages {
  const result: DebugMessages = {
    Communication: [],
    EncodingDecoding: [],
    Visualization: [],
    Authentication: [],
    Warning: warnings.map((message) => ({ message })),
  }
  errors.forEach((error, index) => {
    const category = errorCategories[index]
    if (category !== undefined && ERROR_CATEGORY_KEYS.has(category)) {
      result[category as DebugCategoryKey].push({
        message: error.message,
        source: error.source,
      })
    }
  })
  return result
}

export function formatDebugReport(
  messages: DebugMessages,
  now: Date,
  userAgent: string,
): string {
  const lines: string[] = [
    '=== Slim Debug Report ===',
    `Generated: ${now.toISOString()}`,
    `User agent: ${userAgent}`,
    '',
  ]
  DEBUG_CATEGORIES.forEach((category) => {
    const items = messages[category.key]
    lines.push(`## ${category.name} (${items.length})`)
    items.forEach((item, index) => {
      const source = item.source !== undefined ? ` [${item.source}]` : ''
      lines.push(`  ${index + 1}. ${item.message}${source}`)
    })
    lines.push('')
  })
  return lines.join('\n')
}
