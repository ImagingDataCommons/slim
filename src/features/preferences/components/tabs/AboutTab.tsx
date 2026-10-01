import type * as React from 'react'
import { useMemo } from 'react'

import { SlimLogoMark } from '../../../../components/slim/SlimLogoMark'
import { CopyButton } from '../../../../components/ui/copy-button'
import { Icon } from '../../../../components/ui/icon'
import { cn } from '../../../../lib/utils'
import type { AppInfo } from '../../../../utils/appInfo'
import { buildSupportInfo, getAboutLinks } from '../../utils/about'
import type { RuntimeInfo } from '../../utils/runtimeInfo'

export type AboutAppInfo = Omit<AppInfo, 'uid'>

export interface AboutTabProps {
  app: AboutAppInfo
  runtime: RuntimeInfo
}

export function AboutTab({ app, runtime }: AboutTabProps): React.ReactElement {
  const { rows, supportText } = useMemo(
    () =>
      buildSupportInfo({
        appName: app.name,
        appVersion: app.version,
        slimCommit: runtime.slimCommit,
        dmvVersion: runtime.dmvVersion,
        dmvCommit: runtime.dmvCommit,
        browserLabel: runtime.browserLabel,
        userAgent: runtime.userAgent,
      }),
    [app.name, app.version, runtime],
  )
  const links = useMemo(() => getAboutLinks(app.homepage), [app.homepage])

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[640px] flex-col gap-5 px-6 py-6">
        <div className="flex items-center gap-4 rounded-xl border border-line bg-gradient-to-br from-primary-soft to-panel p-5">
          <div className="h-14 w-14 flex-none overflow-hidden rounded-2xl bg-brand text-white shadow-[0_6px_16px_-6px_rgb(var(--brand)/0.6)]">
            <SlimLogoMark className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[20px] font-semibold leading-tight tracking-[-0.01em] text-ink">
                Slim
              </h3>
              <span className="rounded-full border border-primary/25 bg-panel px-2 py-0.5 font-mono text-11 font-semibold text-primary">
                v{app.version}
              </span>
            </div>
            <p className="mt-1 text-12.5 text-ink-secondary">
              Interoperable web viewer for DICOM slide microscopy images.
            </p>
            {app.organization !== undefined && app.organization !== '' && (
              <p className="mt-0.5 text-12 text-ink-muted">
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
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line-input bg-panel px-3 text-12.5 font-medium text-ink transition-colors hover:border-line-hover hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <Icon name={link.icon} size={16} className="text-ink-secondary" />
              {link.label}
              <Icon name="open_in_new" size={14} className="text-ink-muted" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ))}
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-11 font-semibold uppercase tracking-[0.06em] text-ink-secondary">
              Build information
            </h3>
            <CopyButton
              text={supportText}
              label="Copy for support ticket"
              className="gap-1.5 rounded-lg px-2.5 text-ink"
            />
          </div>
          <dl className="overflow-hidden rounded-xl border border-line">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex min-h-[44px] items-center gap-4 border-b border-line-soft px-4 py-2 last:border-b-0"
              >
                <dt className="w-[200px] flex-none text-12.5 text-ink-secondary">
                  {row.label}
                </dt>
                <dd
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    row.isCode
                      ? 'font-mono text-12 text-ink'
                      : 'text-12.5 text-ink',
                    row.isMissing === true && 'italic text-ink-muted',
                  )}
                  title={row.copyValue ?? row.value}
                >
                  {row.value}
                </dd>
                {row.copyValue !== undefined && (
                  <CopyButton
                    text={row.copyValue}
                    aria-label={`Copy ${row.label}`}
                    className="h-[26px] text-11.5"
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
