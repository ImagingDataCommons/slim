import type * as React from 'react'

import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from '../../../../components/ui/dialog'
import { Icon } from '../../../../components/ui/icon'
import { cn } from '../../../../lib/utils'

type ServerSelectionMode = 'default' | 'custom'

interface ServerSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverUrl: string
  defaultServerUrl?: string
  mode: ServerSelectionMode
  isValid: boolean
  onServerUrlChange: (url: string) => void
  onModeChange: (mode: ServerSelectionMode) => void
  onSubmit: () => void
  onCancel: () => void
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
        'flex cursor-pointer gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
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
        <span className="break-all font-mono text-[11.5px] text-ink-muted">
          {description}
        </span>
      </span>
    </label>
  )
}

export function ServerSelectionDialog({
  open,
  onOpenChange,
  serverUrl,
  defaultServerUrl,
  mode,
  isValid,
  onServerUrlChange,
  onModeChange,
  onSubmit,
  onCancel,
}: ServerSelectionDialogProps): React.ReactElement {
  const showUrlState = serverUrl !== ''
  const urlOk = !showUrlState || isValid

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <SlimDialogHeader
          icon="dns"
          title="DICOMweb server"
          subtitle="Choose where studies are loaded from"
        />
        <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 overflow-auto border-0 px-5 pb-5 pt-[18px]">
          <legend className="sr-only">Server</legend>
          <ServerOption
            selected={mode === 'default'}
            title="Default server"
            description={defaultServerUrl ?? 'Configured in the deployment'}
            onSelect={() => onModeChange('default')}
          />
          <ServerOption
            selected={mode === 'custom'}
            title="Custom server"
            description="Full DICOMweb URL or Google Cloud DICOM store path"
            onSelect={() => onModeChange('custom')}
          />
          {mode === 'custom' && (
            <label className="mt-1 flex flex-col gap-1.5 text-[12px] text-ink-muted">
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
                  onChange={(event) => onServerUrlChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && isValid) onSubmit()
                  }}
                  placeholder="https://… or /projects/…/dicomStores/…"
                  className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[12.5px] text-ink outline-none placeholder:text-ink-fainter"
                />
                {showUrlState && (
                  <Icon
                    name={isValid ? 'check_circle' : 'error'}
                    size={18}
                    className={isValid ? 'text-success' : 'text-destructive'}
                  />
                )}
              </div>
              {showUrlState && (
                <span
                  className={
                    isValid ? 'text-ink-muted' : 'text-destructive-text'
                  }
                >
                  {isValid
                    ? 'Looks like a valid DICOMweb endpoint.'
                    : 'Enter an http(s) URL with a path, or a projects/…/dicomStores/… path.'}
                </span>
              )}
            </label>
          )}
        </fieldset>
        <SlimDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
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
