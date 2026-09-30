import * as React from 'react'

import { cn } from '../lib/utils'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  SlimDialogFooter,
} from './ui/dialog'
import { Icon } from './ui/icon'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'default' | 'destructive'
}

/**
 * A reusable confirmation dialog component.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmDialogProps): React.ReactElement {
  const isDestructive = variant === 'destructive'
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-[420px]">
        <div className="flex gap-3 px-5 pb-5 pt-[18px]">
          <span
            className={cn(
              'grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px]',
              isDestructive
                ? 'bg-destructive-soft text-destructive-text'
                : 'bg-primary-soft text-primary',
            )}
          >
            <Icon name={isDestructive ? 'delete' : 'help'} size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
            <DialogTitle>{title}</DialogTitle>
            {description !== undefined && description !== null ? (
              <DialogDescription asChild>
                <div>{description}</div>
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </div>
        </div>
        <SlimDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </SlimDialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Imperative API for showing confirmation dialogs.
 * Use this for programmatic confirmation flows.
 */
interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

type ConfirmResolve = (confirmed: boolean) => void

interface ConfirmState {
  open: boolean
  options: ConfirmOptions
  resolve: ConfirmResolve | null
}

const ConfirmContext = React.createContext<{
  confirm: (options: ConfirmOptions) => Promise<boolean>
} | null>(null)

export function ConfirmProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const [state, setState] = React.useState<ConfirmState>({
    open: false,
    options: { title: '' },
    resolve: null,
  })

  const confirm = React.useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setState({
          open: true,
          options,
          resolve,
        })
      })
    },
    [],
  )

  const { resolve } = state

  const handleConfirm = React.useCallback(() => {
    resolve?.(true)
    setState((prev) => ({ ...prev, open: false, resolve: null }))
  }, [resolve])

  const handleCancel = React.useCallback(() => {
    resolve?.(false)
    setState((prev) => ({ ...prev, open: false, resolve: null }))
  }, [resolve])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={state.open}
        title={state.options.title}
        description={state.options.description}
        confirmLabel={state.options.confirmLabel}
        cancelLabel={state.options.cancelLabel}
        variant={state.options.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const context = React.useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}

/**
 * Standalone function to show a confirmation dialog without React context.
 * Creates a temporary DOM node and renders the dialog imperatively.
 */
export async function showConfirmDialog(
  options: ConfirmOptions,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const cleanup = (): void => {
      const root = (
        container as unknown as { _reactRoot?: { unmount: () => void } }
      )._reactRoot
      if (root) {
        root.unmount()
      }
      document.body.removeChild(container)
    }

    const handleConfirm = (): void => {
      cleanup()
      resolve(true)
    }

    const handleCancel = (): void => {
      cleanup()
      resolve(false)
    }

    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container)
      ;(container as unknown as { _reactRoot: typeof root })._reactRoot = root
      root.render(
        <ConfirmDialog
          open={true}
          title={options.title}
          description={options.description}
          confirmLabel={options.confirmLabel}
          cancelLabel={options.cancelLabel}
          variant={options.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />,
      )
    })
  })
}
