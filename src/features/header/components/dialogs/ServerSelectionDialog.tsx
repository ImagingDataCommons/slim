import type * as React from 'react'
import { useId, useRef, useState } from 'react'

import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from '../../../../components/ui/dialog'
import { Icon } from '../../../../components/ui/icon'
import { cn } from '../../../../lib/utils'
import type {
  ServerSelectionMode,
  UseServerSelectionReturn,
} from '../../hooks/useServerSelection'

export interface ServerSelectionDialogProps {
  /** State and actions from `useServerSelection`; it also owns `open` */
  selection: UseServerSelectionReturn
  defaultServerUrl?: string
}

const OIDC_EXAMPLE = `{
  "authority": "https://accounts.google.com",
  "clientId": "your-client-id.apps.googleusercontent.com",
  "scope": "email profile openid https://www.googleapis.com/auth/cloud-healthcare",
  "grantType": "implicit"
}`

const FIELD_CLASS =
  'w-full rounded-lg border bg-panel font-mono text-12.5 text-ink outline-hidden transition-colors placeholder:text-ink-fainter focus:border-primary focus:ring-[3px] focus:ring-primary/15'

const FIELD_ERROR_CLASS =
  'border-destructive/70 ring-[3px] ring-destructive/12 focus:border-destructive/70 focus:ring-destructive/12'

function FieldError({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <p
      id={id}
      className="m-0 flex items-start gap-1.5 text-12 text-destructive-text"
    >
      <Icon name="error" size={14} className="mt-px flex-none" />
      {children}
    </p>
  )
}

function ServerOption({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
  children,
}: {
  name: string
  value: ServerSelectionMode
  checked: boolean
  onSelect: (value: ServerSelectionMode) => void
  title: string
  description: React.ReactNode
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-card border px-3.5 py-3 transition-colors',
        checked ? 'border-primary bg-primary/5' : 'border-line',
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onSelect(value)}
          className="mt-0.5 size-4 flex-none cursor-pointer accent-primary"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-13 font-semibold text-ink">{title}</span>
          <span className="break-all text-12 text-ink-muted">
            {description}
          </span>
        </span>
      </label>
      {children}
    </div>
  )
}

/**
 * Pick the deployment's default DICOMweb server or a custom one, with
 * optional OpenID Connect settings for signing in to it.
 */
export function ServerSelectionDialog({
  selection,
  defaultServerUrl,
}: ServerSelectionDialogProps): React.ReactElement {
  const {
    isDialogOpen,
    serverUrl,
    mode,
    isServerUrlValid,
    isValid,
    oidcConfigInput,
    isOidcConfigValid,
    setServerUrl,
    setMode,
    setOidcConfigInput,
    submitSelection,
    cancelDialog,
  } = selection
  const modeName = useId()
  const urlId = useId()
  const urlHintId = useId()
  const urlErrorId = useId()
  const oidcId = useId()
  const oidcHintId = useId()
  const oidcErrorId = useId()
  const urlRef = useRef<HTMLInputElement>(null)
  /** Errors wait for blur or Enter so typing a URL does not flash red */
  const [isUrlTouched, setIsUrlTouched] = useState(false)

  const isCustom = mode === 'custom'
  const hasUrlError = isCustom && isUrlTouched && !isServerUrlValid
  const hasOidcInput = oidcConfigInput.trim() !== ''
  const hasOidcError = hasOidcInput && !isOidcConfigValid

  const selectMode = (value: ServerSelectionMode): void => {
    setMode(value)
    setIsUrlTouched(false)
    if (value === 'custom') {
      requestAnimationFrame(() => urlRef.current?.focus())
    }
  }

  const close = (): void => {
    setIsUrlTouched(false)
    cancelDialog()
  }

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent
        className="max-w-[560px]"
        onOpenAutoFocus={(event) => {
          if (!isCustom) return
          event.preventDefault()
          urlRef.current?.focus()
        }}
      >
        <SlimDialogHeader
          icon="dns"
          title="Select DICOMweb server"
          subtitle="The server Slim loads studies and slides from"
        />
        <div className="flex min-h-0 flex-col gap-6 overflow-auto px-5 py-5">
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="sr-only">Server</legend>
            <ServerOption
              name={modeName}
              value="default"
              checked={!isCustom}
              onSelect={selectMode}
              title="Use default server"
              description={
                defaultServerUrl !== undefined && defaultServerUrl !== ''
                  ? defaultServerUrl
                  : "The server set in this deployment's configuration"
              }
            />
            <ServerOption
              name={modeName}
              value="custom"
              checked={isCustom}
              onSelect={selectMode}
              title="Use custom server"
              description="A DICOMweb URL or a Google Cloud DICOM store path"
            >
              {isCustom && (
                <div className="flex flex-col gap-1.5 pl-7">
                  <label htmlFor={urlId} className="sr-only">
                    Server URL
                  </label>
                  <div className="relative">
                    <input
                      id={urlId}
                      ref={urlRef}
                      type="text"
                      value={serverUrl}
                      onChange={(event) => setServerUrl(event.target.value)}
                      onBlur={() => setIsUrlTouched(true)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        setIsUrlTouched(true)
                        if (isValid) submitSelection()
                      }}
                      aria-invalid={hasUrlError}
                      aria-describedby={hasUrlError ? urlErrorId : urlHintId}
                      placeholder="Full URL or GCP path (e.g. /projects/.../dicomStores/my-store)"
                      spellCheck={false}
                      autoComplete="off"
                      className={cn(
                        FIELD_CLASS,
                        'h-9 pl-3 pr-9',
                        hasUrlError ? FIELD_ERROR_CLASS : 'border-line-input',
                      )}
                    />
                    <Icon
                      name={isServerUrlValid ? 'check_circle' : 'error'}
                      size={16}
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2',
                        isServerUrlValid ? 'text-success' : 'text-ink-faint',
                      )}
                    />
                  </div>
                  {hasUrlError ? (
                    <FieldError id={urlErrorId}>
                      {serverUrl === ''
                        ? 'Enter the URL of a DICOMweb server.'
                        : 'Enter a URL starting with http:// or https://, or a Google Cloud DICOM store path.'}
                    </FieldError>
                  ) : (
                    <p id={urlHintId} className="m-0 text-12 text-ink-muted">
                      Press Enter to connect.
                    </p>
                  )}
                </div>
              )}
            </ServerOption>
          </fieldset>

          <section className="flex flex-col gap-2">
            <div className="flex min-h-6 items-center gap-2">
              <label
                htmlFor={oidcId}
                className="text-13 font-semibold text-ink"
              >
                OIDC configuration
              </label>
              <span className="text-12 text-ink-muted">Optional</span>
              {hasOidcInput && (
                <button
                  type="button"
                  onClick={() => setOidcConfigInput('')}
                  className="ml-auto rounded-sm text-12 font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              id={oidcId}
              rows={6}
              value={oidcConfigInput}
              onChange={(event) => setOidcConfigInput(event.target.value)}
              placeholder={OIDC_EXAMPLE}
              spellCheck={false}
              aria-invalid={hasOidcError}
              aria-describedby={hasOidcError ? oidcErrorId : oidcHintId}
              className={cn(
                FIELD_CLASS,
                'resize-y px-3 py-2 text-12 leading-normal',
                hasOidcError ? FIELD_ERROR_CLASS : 'border-line-input',
              )}
            />
            {hasOidcError ? (
              <FieldError id={oidcErrorId}>
                Invalid JSON format. Required fields: authority, clientId and
                scope.
              </FieldError>
            ) : (
              <p id={oidcHintId} className="m-0 text-12 text-ink-muted">
                OpenID Connect settings as JSON. Leave empty to sign in with the
                deployment's identity provider.
              </p>
            )}
          </section>
        </div>
        <SlimDialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setIsUrlTouched(true)
              submitSelection()
            }}
            disabled={!isValid}
            className="font-semibold"
          >
            OK
          </Button>
        </SlimDialogFooter>
      </DialogContent>
    </Dialog>
  )
}
