/** Pure grouping and plain-text formatting for the Debug dialog. */

import type { IconName } from '../../../components/ui/icon'

type DebugErrorCategoryKey =
  | 'Communication'
  | 'EncodingDecoding'
  | 'Visualization'
  | 'Authentication'

export type DebugCategoryKey = DebugErrorCategoryKey | 'Warning'

export interface DebugCategory {
  key: DebugCategoryKey
  name: string
  icon: IconName
  isWarning?: boolean
}

/** Shape of a reported error notification that the report reads */
export interface DebugErrorNotification {
  error: { message: string; type?: unknown }
  source?: string
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

const ERROR_CATEGORY_KEYS: ReadonlySet<unknown> =
  new Set<DebugErrorCategoryKey>([
    'Communication',
    'EncodingDecoding',
    'Visualization',
    'Authentication',
  ])

function isErrorCategoryKey(value: unknown): value is DebugErrorCategoryKey {
  return ERROR_CATEGORY_KEYS.has(value)
}

/** Bucket errors by their `error.type`; errors of unknown type are dropped. */
export function buildDebugMessages(
  notifications: readonly DebugErrorNotification[],
  warnings: readonly string[],
): DebugMessages {
  const result: DebugMessages = {
    Communication: [],
    EncodingDecoding: [],
    Visualization: [],
    Authentication: [],
    Warning: warnings.map((message) => ({ message })),
  }
  for (const { error, source } of notifications) {
    const category = error.type
    if (isErrorCategoryKey(category)) {
      result[category].push({ message: error.message, source })
    }
  }
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
