import { detect } from 'detect-browser'
import type * as React from 'react'
import { useId, useMemo, useState } from 'react'

import appPackageJson from '../../../../package.json'
import { SlimLogoMark } from '../../../components/slim/SlimLogoMark'
import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from '../../../components/ui/dialog'
import { Icon } from '../../../components/ui/icon'
import { SegmentedControl } from '../../../components/ui/segmented'
import { Switch } from '../../../components/ui/switch'
import type { Theme } from '../../../contexts/ThemeContext'
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard'
import { cn } from '../../../lib/utils'
import { downloadTextFile } from '../../../utils/download'
import {
  type PreferencesTab,
  usePreferencesDraft,
} from '../hooks/usePreferencesDraft'
import {
  buildSupportInfo,
  formatBrowserLabel,
  getAboutLinks,
  getDependencyVersion,
} from '../utils/about'
import {
  filterConfigRows,
  flattenConfig,
  formatConfigValue,
  maskConfig,
  splitByQuery,
} from '../utils/configRows'
import { type MeasurementUnit, STROKE_COLORS } from '../utils/preferences'

export type { PreferencesTab }

interface PreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  app: {
    name: string
    version: string
    homepage: string
    uid: string
    organization?: string
  }
  initialTab?: PreferencesTab
}

const USER_TABS: Array<{ id: PreferencesTab; label: string; icon: string }> = [
  { id: 'general', label: 'General', icon: 'settings' },
  { id: 'annotations', label: 'Annotations', icon: 'polyline' },
  { id: 'keys', label: 'Keyboard shortcuts', icon: 'keyboard' },
]

const APP_TABS: Array<{ id: PreferencesTab; label: string; icon: string }> = [
  { id: 'config', label: 'Configuration', icon: 'settings_applications' },
  { id: 'about', label: 'About Slim', icon: 'info' },
]

const KEYBOARD_SHORTCUTS = [
  { action: 'Draw ROI', key: 'D' },
  { action: 'Modify ROIs', key: 'M' },
  { action: 'Translate ROIs', key: 'T' },
  { action: 'Remove selected ROI', key: 'R' },
  { action: 'Show / hide ROIs', key: 'V' },
  { action: 'Save ROIs', key: 'S' },
  { action: 'Go to position', key: 'G' },
]

const THEME_OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const UNIT_OPTIONS: Array<{ value: MeasurementUnit; label: string }> = [
  { value: 'µm', label: 'µm' },
  { value: 'mm', label: 'mm' },
]

function SectionLabel({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="mb-0.5 mt-[18px] text-[11px] font-semibold uppercase leading-none tracking-[0.06em] text-ink-secondary">
      {children}
    </div>
  )
}

interface PreferenceControlProps {
  'aria-labelledby': string
  'aria-describedby'?: string
}

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  /** Receives the ARIA props that name the control after the row label */
  children: (controlProps: PreferenceControlProps) => React.ReactNode
}): React.ReactElement {
  const id = useId()
  const labelId = `${id}-label`
  const descriptionId = description !== undefined ? `${id}-desc` : undefined
  return (
    <div className="flex items-center gap-4 border-b border-line-soft py-3">
      <div className="min-w-0 flex-1">
        <div id={labelId} className="font-medium text-ink">
          {label}
        </div>
        {description !== undefined && (
          <div id={descriptionId} className="mt-0.5 text-[12px] text-ink-muted">
            {description}
          </div>
        )}
      </div>
      {children({
        'aria-labelledby': labelId,
        'aria-describedby': descriptionId,
      })}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd className="min-w-[26px] rounded-[5px] border border-b-2 border-line-input bg-panel px-[7px] py-[3px] text-center font-mono text-[11.5px] font-medium text-ink-body">
      {children}
    </kbd>
  )
}

function NavButton({
  tab,
  isActive,
  onSelect,
}: {
  tab: { id: PreferencesTab; label: string; icon: string }
  isActive: boolean
  onSelect: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
        isActive
          ? 'bg-segmented-active text-primary shadow-[0_1px_2px_rgb(var(--shadow-color)/0.1)]'
          : 'text-ink-secondary hover:text-ink',
      )}
    >
      <Icon name={tab.icon} size={18} />
      {tab.label}
    </button>
  )
}

function CopyButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string
  label?: string
  className?: string
}): React.ReactElement {
  const { copied, copy } = useCopyToClipboard(1500)
  return (
    <button
      type="button"
      onClick={() => {
        void copy(text)
      }}
      className={cn(
        'flex flex-none items-center gap-1 rounded-md border border-line-input bg-panel font-medium hover:bg-subtle',
        copied ? 'text-success' : 'text-ink-secondary',
        className,
      )}
    >
      <Icon name={copied ? 'check' : 'content_copy'} size={15} />
      {copied ? 'Copied' : label}
    </button>
  )
}

function HighlightedText({
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
}

function configValueColor(raw: unknown): string {
  if (typeof raw === 'number') return 'text-primary'
  if (typeof raw === 'boolean') return 'text-syntax-boolean'
  if (typeof raw === 'string') return 'text-syntax-string'
  return 'text-ink-muted'
}

function ConfigurationTab(): React.ReactElement {
  const [query, setQuery] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [view, setView] = useState<'tree' | 'json'>('tree')

  const maskedConfig = useMemo(() => maskConfig(window.config ?? {}), [])
  const rows = useMemo(() => flattenConfig(maskedConfig), [maskedConfig])
  const visibleRows = useMemo(
    () => filterConfigRows(rows, query, onlyChanged),
    [rows, query, onlyChanged],
  )
  const changedCount = rows.filter(
    (row) => !row.isGroup && row.isChanged,
  ).length
  const leafMatchCount = visibleRows.filter((row) => !row.isGroup).length
  const json = `window.config = ${JSON.stringify(
    maskedConfig,
    (_key, value: unknown) =>
      typeof value === 'function' ? formatConfigValue(value) : value,
    2,
  )}`
  const configName = process.env.REACT_APP_CONFIG ?? 'local'

  const download = (): void => {
    downloadTextFile(`${configName}.js`, json, 'text/javascript')
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-none flex-col gap-2.5 border-b border-line-soft px-5 py-3">
        <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-line-input bg-panel px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <Icon name="search" size={18} className="flex-none text-ink-muted" />
          <input
            type="search"
            aria-label="Search configuration"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keys and values"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-fainter [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query !== '' && (
            <>
              <span className="flex-none text-[11.5px] text-ink-muted">
                {leafMatchCount} {leafMatchCount === 1 ? 'match' : 'matches'}
              </span>
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="grid h-5 w-5 flex-none place-items-center rounded text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <Icon name="close" size={15} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={onlyChanged}
            onClick={() => setOnlyChanged((value) => !value)}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium',
              onlyChanged
                ? 'border-warning/60 bg-warning-soft text-warning-text'
                : 'border-line-input bg-panel text-ink-body',
            )}
          >
            <span className="h-[7px] w-[7px] rounded-full bg-warning" />
            Changed from default
            <span className="font-mono text-[11px] font-medium">
              {changedCount}
            </span>
          </button>
          <SegmentedControl
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'tree', label: 'Tree', icon: 'account_tree' },
              { value: 'json', label: 'JSON', icon: 'data_object' },
            ]}
          />
          <div className="flex-1" />
          <CopyButton
            text={json}
            className="h-8 rounded-lg px-3 text-[12.5px] text-ink"
          />
          <button
            type="button"
            onClick={download}
            className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line-input bg-panel px-3 text-[12.5px] font-medium text-ink hover:bg-subtle"
          >
            <Icon name="download" size={17} />
            Download
          </button>
        </div>
      </div>
      <div className="flex flex-none items-center gap-2 border-b border-line-soft bg-subtle px-5 py-2 text-[12px] text-ink-secondary">
        <Icon name="lock" size={16} className="text-ink-muted" />
        <span>
          Read-only. Loaded at startup from{' '}
          <code className="font-mono text-[11.5px] font-medium text-ink">
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
                      ? 'text-[12.5px] font-semibold'
                      : 'font-mono text-[12px]',
                  )}
                >
                  <HighlightedText text={row.key} query={query} />
                </span>
              </div>
              <div
                className={cn(
                  'break-all py-1.5 font-mono text-[12px]',
                  configValueColor(row.raw),
                )}
              >
                <HighlightedText text={row.value} query={query} />
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
        <pre className="m-0 min-h-0 flex-1 overflow-auto whitespace-pre bg-subtle px-5 py-4 font-mono text-[12px] leading-[1.6] text-ink-body">
          <HighlightedText text={json} query={query} />
        </pre>
      )}
    </div>
  )
}

function AboutTab({
  app,
}: {
  app: PreferencesDialogProps['app']
}): React.ReactElement {
  const { rows, supportText } = useMemo(
    () =>
      buildSupportInfo({
        appName: app.name,
        appVersion: app.version,
        slimCommit: process.env.REACT_APP_GIT_SHA,
        dmvVersion: getDependencyVersion(
          appPackageJson,
          'dicom-microscopy-viewer',
        ),
        dmvCommit: process.env.REACT_APP_DMV_GIT_SHA,
        browserLabel: formatBrowserLabel(detect(), navigator.userAgent),
        userAgent: navigator.userAgent,
      }),
    [app.name, app.version],
  )
  const links = useMemo(() => getAboutLinks(app.homepage), [app.homepage])

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[640px] flex-col gap-5 px-6 py-6">
        <div className="flex items-center gap-4 rounded-xl border border-line bg-gradient-to-br from-primary-soft to-panel p-5">
          <div className="h-14 w-14 flex-none overflow-hidden rounded-2xl bg-brand text-white shadow-[0_6px_16px_-6px_rgb(61_79_107/0.6)]">
            <SlimLogoMark className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[20px] font-semibold leading-tight tracking-[-0.01em] text-ink">
                Slim
              </h3>
              <span className="rounded-full border border-primary/25 bg-panel px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                v{app.version}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-ink-secondary">
              Interoperable web viewer for DICOM slide microscopy images.
            </p>
            {app.organization !== undefined && app.organization !== '' && (
              <p className="mt-0.5 text-[12px] text-ink-muted">
                {app.organization}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line-input bg-panel px-3 text-[12.5px] font-medium text-ink transition-colors hover:border-line-hover hover:bg-subtle"
            >
              <Icon name={link.icon} size={16} className="text-ink-secondary" />
              {link.label}
              <Icon name="open_in_new" size={14} className="text-ink-muted" />
            </a>
          ))}
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-secondary">
              Build information
            </h3>
            <CopyButton
              text={supportText}
              label="Copy for support ticket"
              className="h-7 gap-1.5 rounded-lg px-2.5 text-[12px] text-ink"
            />
          </div>
          <dl className="overflow-hidden rounded-xl border border-line">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex min-h-[44px] items-center gap-4 border-b border-line-soft px-4 py-2 last:border-b-0"
              >
                <dt className="w-[200px] flex-none text-[12.5px] text-ink-secondary">
                  {row.label}
                </dt>
                <dd
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    row.isCode
                      ? 'font-mono text-[12px] text-ink'
                      : 'text-[12.5px] text-ink',
                    row.isMissing === true && 'italic text-ink-muted',
                  )}
                  title={row.copyValue ?? row.value}
                >
                  {row.value}
                </dd>
                {row.copyValue !== undefined && (
                  <CopyButton
                    text={row.copyValue}
                    className="h-[26px] px-2 text-[11.5px]"
                  />
                )}
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}

export function PreferencesDialog({
  open,
  onOpenChange,
  app,
  initialTab = 'general',
}: PreferencesDialogProps): React.ReactElement {
  const {
    activeTab,
    setActiveTab,
    draftTheme,
    setDraftTheme,
    draft,
    update,
    save,
  } = usePreferencesDraft(open, initialTab)

  const handleSave = (): void => {
    save()
    onOpenChange(false)
  }

  const isStandardTab = activeTab !== 'config' && activeTab !== 'about'
  const subtitle =
    activeTab === 'config'
      ? 'Read-only deployment settings'
      : activeTab === 'about'
        ? 'Version and build information'
        : 'Saved to your profile on this device'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[78vh] max-h-[88vh] w-[94vw] max-w-[1000px]">
        <SlimDialogHeader
          icon="manage_accounts"
          title="Preferences"
          subtitle={subtitle}
        />

        <div className="flex min-h-0 flex-1">
          <nav className="flex w-[200px] flex-none flex-col gap-0.5 border-r border-line-soft bg-subtle p-3">
            {USER_TABS.map((tab) => (
              <NavButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onSelect={() => setActiveTab(tab.id)}
              />
            ))}
            <div className="mx-2.5 mb-1.5 mt-3.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em] text-ink-muted">
              Application
            </div>
            {APP_TABS.map((tab) => (
              <NavButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onSelect={() => setActiveTab(tab.id)}
              />
            ))}
          </nav>

          {isStandardTab && (
            <div className="min-w-0 flex-1 overflow-auto px-6 pb-5 pt-1">
              {activeTab === 'general' && (
                <>
                  <SectionLabel>Appearance</SectionLabel>
                  <div className="flex flex-col gap-2 border-b border-line-soft pb-3.5 pt-2.5">
                    <div className="font-medium text-ink">Theme</div>
                    <SegmentedControl
                      fill
                      aria-label="Theme"
                      value={draftTheme}
                      onChange={setDraftTheme}
                      options={THEME_OPTIONS}
                    />
                  </div>
                  <SectionLabel>Worklist</SectionLabel>
                  <PreferenceRow
                    label="Compact rows"
                    description="Show more studies per page"
                  >
                    {(controlProps) => (
                      <Switch
                        {...controlProps}
                        size="lg"
                        checked={draft.compactRows}
                        onCheckedChange={(value) =>
                          update('compactRows', value)
                        }
                      />
                    )}
                  </PreferenceRow>
                  <PreferenceRow
                    label="Remember filters"
                    description="Keep the date filter between sessions"
                  >
                    {(controlProps) => (
                      <Switch
                        {...controlProps}
                        size="lg"
                        checked={draft.rememberFilters}
                        onCheckedChange={(value) =>
                          update('rememberFilters', value)
                        }
                      />
                    )}
                  </PreferenceRow>
                </>
              )}

              {activeTab === 'annotations' && (
                <>
                  <SectionLabel>Drawing style</SectionLabel>
                  <div className="flex flex-col gap-2.5 border-b border-line-soft py-3">
                    <div>
                      <div className="font-medium text-ink">Stroke color</div>
                      <div className="mt-0.5 text-[12px] text-ink-muted">
                        Applied to new ROIs you draw
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {STROKE_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Stroke color ${color}`}
                          aria-pressed={draft.strokeColor === color}
                          onClick={() => update('strokeColor', color)}
                          className="h-7 w-7 rounded-full border-2 border-panel"
                          style={{
                            backgroundColor: color,
                            boxShadow:
                              draft.strokeColor === color
                                ? `0 0 0 2px ${color}`
                                : '0 0 0 1px rgb(var(--line-input))',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-b border-line-soft py-3">
                    <div className="flex-1 font-medium text-ink">
                      Stroke width
                    </div>
                    <input
                      type="range"
                      aria-label="Stroke width"
                      min={1}
                      max={6}
                      value={draft.strokeWidth}
                      onChange={(event) =>
                        update('strokeWidth', Number(event.target.value))
                      }
                      className="w-[180px]"
                    />
                    <span className="w-9 text-right font-mono text-[12px] font-medium">
                      {draft.strokeWidth} px
                    </span>
                  </div>
                  <SectionLabel>Measurements</SectionLabel>
                  <PreferenceRow
                    label="Measurement units"
                    description="Lengths and areas in the annotation list and ROI details"
                  >
                    {() => (
                      <SegmentedControl
                        fill
                        className="w-40"
                        aria-label="Measurement units"
                        value={draft.units}
                        onChange={(value) => update('units', value)}
                        options={UNIT_OPTIONS}
                      />
                    )}
                  </PreferenceRow>
                  <SectionLabel>Editing</SectionLabel>
                  <PreferenceRow
                    label="Confirm before removing"
                    description="Ask before deleting a selected ROI"
                  >
                    {(controlProps) => (
                      <Switch
                        {...controlProps}
                        size="lg"
                        checked={draft.confirmRoiRemoval}
                        onCheckedChange={(value) =>
                          update('confirmRoiRemoval', value)
                        }
                      />
                    )}
                  </PreferenceRow>
                </>
              )}

              {activeTab === 'keys' && (
                <>
                  <SectionLabel>Annotation tools</SectionLabel>
                  {KEYBOARD_SHORTCUTS.map(({ action, key }) => (
                    <div
                      key={action}
                      className="flex items-center border-b border-line-soft py-2.5"
                    >
                      <span className="flex-1 text-ink">{action}</span>
                      <span className="flex gap-1">
                        <Kbd>Alt</Kbd>
                        <Kbd>{key}</Kbd>
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {activeTab === 'config' && <ConfigurationTab />}
          {activeTab === 'about' && <AboutTab app={app} />}
        </div>

        {isStandardTab && (
          <SlimDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="font-semibold">
              Save preferences
            </Button>
          </SlimDialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
