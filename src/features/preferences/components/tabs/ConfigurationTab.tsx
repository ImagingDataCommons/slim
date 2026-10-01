import type * as React from 'react'
import { memo, useDeferredValue, useMemo, useState } from 'react'

import { Button } from '../../../../components/ui/button'
import { CopyButton } from '../../../../components/ui/copy-button'
import { Icon } from '../../../../components/ui/icon'
import { SearchInput } from '../../../../components/ui/search-input'
import { SegmentedControl } from '../../../../components/ui/segmented'
import { cn } from '../../../../lib/utils'
import { downloadTextFile } from '../../../../utils/download'
import {
  countChangedRows,
  filterConfigRows,
  flattenConfig,
  formatConfigScript,
  maskConfig,
  splitByQuery,
} from '../../utils/configRows'

type ConfigView = 'tree' | 'json'

const VIEW_OPTIONS: Array<{
  value: ConfigView
  label: string
  icon: 'account_tree' | 'data_object'
}> = [
  { value: 'tree', label: 'Tree', icon: 'account_tree' },
  { value: 'json', label: 'JSON', icon: 'data_object' },
]

const HighlightedText = memo(function HighlightedText({
  text,
  query,
}: {
  text: string
  query: string
}): React.ReactElement {
  const segments = splitByQuery(text, query)
  return (
    <>
      {segments.map((segment) =>
        segment.isMatch ? (
          <mark
            key={segment.start}
            className="rounded-[3px] bg-warning-soft px-px text-inherit ring-1 ring-warning/40"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={segment.start}>{segment.text}</span>
        ),
      )}
    </>
  )
})

function configValueColor(raw: unknown): string {
  if (typeof raw === 'number') return 'text-primary'
  if (typeof raw === 'boolean') return 'text-syntax-boolean'
  if (typeof raw === 'string') return 'text-syntax-string'
  return 'text-ink-muted'
}

export interface ConfigurationTabProps {
  /** Deployment config (`window.config`); secrets are masked before display */
  config: unknown
  /** Config file name under public/config, without `.js` */
  configName: string
}

/** Read-only, searchable view of the deployment configuration. */
export function ConfigurationTab({
  config,
  configName,
}: ConfigurationTabProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [view, setView] = useState<ConfigView>('tree')

  const maskedConfig = useMemo(() => maskConfig(config), [config])
  const rows = useMemo(() => flattenConfig(maskedConfig), [maskedConfig])
  const changedCount = useMemo(() => countChangedRows(rows), [rows])
  const script = useMemo(() => formatConfigScript(maskedConfig), [maskedConfig])
  const visibleRows = useMemo(
    () => filterConfigRows(rows, deferredQuery, onlyChanged),
    [rows, deferredQuery, onlyChanged],
  )
  const leafMatchCount = visibleRows.filter((row) => !row.isGroup).length

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-none flex-col gap-2.5 border-b border-line-soft px-5 py-3">
        <SearchInput
          aria-label="Search configuration"
          placeholder="Search keys and values"
          value={query}
          onValueChange={setQuery}
          clearable
          status={`${leafMatchCount} ${leafMatchCount === 1 ? 'match' : 'matches'}`}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={onlyChanged}
            onClick={() => setOnlyChanged((value) => !value)}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-full border px-3 text-12.5 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              onlyChanged
                ? 'border-warning/60 bg-warning-soft text-warning-text'
                : 'border-line-input bg-panel text-ink-body',
            )}
          >
            <span className="h-[7px] w-[7px] rounded-full bg-warning" />
            Changed from default
            <span className="font-mono text-11 font-medium">
              {changedCount}
            </span>
          </button>
          <SegmentedControl
            size="sm"
            aria-label="Configuration view"
            value={view}
            onChange={setView}
            options={VIEW_OPTIONS}
          />
          <div className="flex-1" />
          <CopyButton
            text={script}
            size="sm"
            className="h-8 rounded-lg px-3 text-ink"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-3 text-ink"
            onClick={() => {
              downloadTextFile(`${configName}.js`, script, 'text/javascript')
            }}
          >
            <Icon name="download" size={17} />
            Download
          </Button>
        </div>
      </div>
      <div className="flex flex-none items-center gap-2 border-b border-line-soft bg-subtle px-5 py-2 text-12 text-ink-secondary">
        <Icon name="lock" size={16} className="text-ink-muted" />
        <span>
          Read-only. Loaded at startup from{' '}
          <code className="text-11.5 font-medium text-ink">
            public/config/{configName}.js
          </code>
          . Change the file and redeploy to update. Secrets are masked.
        </span>
      </div>
      {view === 'tree' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          {visibleRows.map((row) => (
            <div
              key={row.path}
              className={cn(
                'grid min-h-[32px] grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_88px] items-center gap-4 border-b border-line-row px-5',
                row.isGroup && row.depth === 0 ? 'bg-subtle' : 'bg-panel',
              )}
            >
              <div
                className="flex min-w-0 items-center gap-1.5"
                style={{ paddingLeft: row.depth * 18 }}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 flex-none rounded-full',
                    !row.isGroup && row.isChanged
                      ? 'bg-warning'
                      : 'bg-transparent',
                  )}
                />
                <span
                  className={cn(
                    'truncate text-ink',
                    row.isGroup
                      ? 'text-12.5 font-semibold'
                      : 'font-mono text-12',
                  )}
                >
                  <HighlightedText text={row.key} query={deferredQuery} />
                </span>
              </div>
              <div
                className={cn(
                  'break-all py-1.5 font-mono text-12',
                  configValueColor(row.raw),
                )}
              >
                <HighlightedText text={row.value} query={deferredQuery} />
              </div>
              <div className="text-right">
                {!row.isGroup && (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 font-mono text-[10.5px] font-medium',
                      row.isChanged
                        ? 'bg-primary-soft text-primary'
                        : 'bg-app text-ink-muted',
                    )}
                  >
                    {row.isChanged ? `${configName}.js` : 'default'}
                  </span>
                )}
              </div>
            </div>
          ))}
          {visibleRows.length === 0 && (
            <div className="px-5 py-12 text-center text-ink-muted">
              No keys match.
            </div>
          )}
        </div>
      ) : (
        <pre className="m-0 min-h-0 flex-1 overflow-auto whitespace-pre bg-subtle px-5 py-4 font-mono text-12 leading-[1.6] text-ink-body">
          <HighlightedText text={script} query={deferredQuery} />
        </pre>
      )}
    </div>
  )
}
