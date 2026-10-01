import type * as React from 'react'
import { useId, useState } from 'react'

import { Button } from '../../../../components/ui/button'
import { CopyButton } from '../../../../components/ui/copy-button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from '../../../../components/ui/dialog'
import { Icon } from '../../../../components/ui/icon'
import { cn } from '../../../../lib/utils'
import type { UseServerSelectionReturn } from '../../hooks/useServerSelection'

export interface ServerSelectionDialogProps {
  /** State and actions from `useServerSelection`; it also owns `open` */
  selection: UseServerSelectionReturn
  /** Server the app is connected to right now */
  currentServerUrl?: string
  defaultServerUrl?: string
}

function ServerOption({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean
  title: string
  description: string
  onSelect: () => void
}): React.ReactElement {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-card border px-3.5 py-3 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
        selected
          ? 'border-primary bg-selected shadow-selected-ring'
          : 'border-line bg-panel hover:border-line-hover',
      )}
    >
      <input
        type="radio"
        name="dicomweb-server"
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        className={cn(
          'mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-2',
          selected ? 'border-primary' : 'border-switch-off',
        )}
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            selected ? 'bg-primary' : 'bg-transparent',
          )}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="font-semibold text-ink">{title}</span>
        <span className="break-all font-mono text-11.5 text-ink-muted">
          {description}
        </span>
      </span>
    </label>
  )
}

function CurrentServer({ url }: { url: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-subtle px-3.5 py-2.5">
      <span className="h-[7px] w-[7px] flex-none rounded-full bg-success" />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-11 font-semibold uppercase tracking-[0.06em] text-ink-secondary">
          Connected to
        </span>
        <span className="break-all font-mono text-12 text-ink">{url}</span>
      </div>
      <CopyButton
        text={url}
        aria-label="Copy server URL"
        className="flex-none text-ink-secondary"
      />
    </div>
  )
}

const OIDC_EXAMPLE = `{
  "authority": "https://accounts.google.com",
  "clientId": "your-client-id.apps.googleusercontent.com",
  "scope": "email profile openid https://www.googleapis.com/auth/cloud-healthcare",
  "grantType": "implicit"
}`

function OidcConfigSection({
  value,
  isValid,
  onChange,
}: {
  value: string
  isValid: boolean
  onChange: (input: string) => void
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(value.trim() !== '')
  const textareaId = useId()
  const errorId = useId()
  const hasError = value.trim() !== '' && !isValid
  return (
    <div className="mt-1 rounded-card border border-line">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={textareaId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-2 rounded-card px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Icon
          name={isOpen ? 'expand_more' : 'chevron_right'}
          size={18}
          className="text-ink-faint"
        />
        <span className="flex-1 font-semibold text-ink">
          Sign-in (OIDC)
          <span className="ml-1.5 font-normal text-ink-muted">optional</span>
        </span>
        {value.trim() !== '' && (
          <span
            className={cn(
              'rounded-full px-1.5 py-[3px] text-11 font-semibold leading-none',
              isValid
                ? 'bg-primary-soft text-primary'
                : 'bg-destructive/10 text-destructive-text',
            )}
          >
            {isValid ? 'Custom' : 'Invalid'}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 text-12 text-ink-muted">
          <label htmlFor={textareaId}>
            Override the deployment's identity provider. Leave empty to use the
            default.
          </label>
          <textarea
            id={textareaId}
            rows={5}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={OIDC_EXAMPLE}
            spellCheck={false}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className={cn(
              'resize-y rounded-lg border bg-panel px-2.5 py-2 font-mono text-12 leading-[1.5] text-ink outline-none placeholder:text-ink-fainter focus:border-primary',
              hasError
                ? 'border-destructive/70 shadow-[0_0_0_3px_rgb(var(--destructive)/0.12)]'
                : 'border-line-input',
            )}
          />
          {hasError && (
            <span id={errorId} className="text-destructive-text">
              Invalid JSON. Required fields: authority, clientId, scope.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function ServerSelectionDialog({
  selection,
  currentServerUrl,
  defaultServerUrl,
}: ServerSelectionDialogProps): React.ReactElement {
  const {
    isDialogOpen,
    serverUrl,
    mode,
    isValid,
    isServerUrlValid,
    oidcConfigInput,
    isOidcConfigValid,
    setServerUrl,
    setMode,
    setOidcConfigInput,
    submitSelection,
    cancelDialog,
  } = selection
  const urlMessageId = useId()
  const showUrlState = serverUrl !== ''
  const urlOk = !showUrlState || isServerUrlValid

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (!open) cancelDialog()
      }}
    >
      <DialogContent className="max-w-[520px]">
        <SlimDialogHeader
          icon="dns"
          title="DICOMweb server"
          subtitle="Choose where studies are loaded from"
        />
        <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 overflow-auto border-0 px-5 pb-5 pt-[18px]">
          <legend className="sr-only">Server</legend>
          {currentServerUrl !== undefined && currentServerUrl !== '' && (
            <CurrentServer url={currentServerUrl} />
          )}
          <ServerOption
            selected={mode === 'default'}
            title="Default server"
            description={defaultServerUrl ?? 'Configured in the deployment'}
            onSelect={() => setMode('default')}
          />
          <ServerOption
            selected={mode === 'custom'}
            title="Custom server"
            description="Full DICOMweb URL or Google Cloud DICOM store path"
            onSelect={() => setMode('custom')}
          />
          {mode === 'custom' && (
            <label className="mt-1 flex flex-col gap-1.5 text-12 text-ink-muted">
              Server URL
              <div
                className={cn(
                  'flex h-[38px] items-center gap-2 rounded-lg border px-2.5 focus-within:border-primary',
                  urlOk
                    ? 'border-line-input'
                    : 'border-destructive/70 shadow-[0_0_0_3px_rgb(var(--destructive)/0.12)]',
                )}
              >
                <input
                  autoFocus
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && isValid) submitSelection()
                  }}
                  aria-invalid={!urlOk}
                  aria-describedby={showUrlState ? urlMessageId : undefined}
                  placeholder="https://… or /projects/…/dicomStores/…"
                  className="min-w-0 flex-1 border-0 bg-transparent font-mono text-12.5 text-ink outline-none placeholder:text-ink-fainter"
                />
                {showUrlState && (
                  <Icon
                    name={isServerUrlValid ? 'check_circle' : 'error'}
                    size={18}
                    className={
                      isServerUrlValid ? 'text-success' : 'text-destructive'
                    }
                  />
                )}
              </div>
              {showUrlState && (
                <span
                  id={urlMessageId}
                  className={
                    isServerUrlValid
                      ? 'text-ink-muted'
                      : 'text-destructive-text'
                  }
                >
                  {isServerUrlValid
                    ? 'Looks like a valid DICOMweb endpoint.'
                    : 'Enter an http(s) URL with a path, or a projects/…/dicomStores/… path.'}
                </span>
              )}
            </label>
          )}
          <OidcConfigSection
            value={oidcConfigInput}
            isValid={isOidcConfigValid}
            onChange={setOidcConfigInput}
          />
        </fieldset>
        <SlimDialogFooter>
          <Button variant="outline" onClick={cancelDialog}>
            Cancel
          </Button>
          <Button
            onClick={submitSelection}
            disabled={!isValid}
            className="font-semibold"
          >
            Connect
          </Button>
        </SlimDialogFooter>
      </DialogContent>
    </Dialog>
  )
}
