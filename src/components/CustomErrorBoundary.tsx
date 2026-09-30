import { useCallback, useState } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'

import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from './ui/dialog'
import { Icon } from './ui/icon'

/**
 * React's error boundary component to catch errors during rendering phase
 * FallbackComponent is rendered in the event of an error
 *
 * @param context - name of the react component
 * @param children - the component wrapped inside the Custom Error Boundary
 */
const CustomErrorBoundary = ({
  context,
  children,
}: {
  context: string
  children: JSX.Element
}): JSX.Element => {
  const ErrorFallback = (error: FallbackProps): JSX.Element => {
    const [isOpen, setIsOpen] = useState(false)

    const openModal = useCallback((): void => {
      setIsOpen(true)
    }, [])

    const handleClick = useCallback((): void => {
      openModal()
    }, [openModal])

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent): void => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openModal()
        }
      },
      [openModal],
    )

    return (
      <div>
        <p className="text-sm">
          There was an error in loading this page.{' '}
          <button
            type="button"
            className="text-primary hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            aria-label="Show error details"
          >
            Click for error details
          </button>
        </p>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-3xl">
            <SlimDialogHeader
              icon="error"
              title={`Unexpected error in the ${context} component`}
              subtitle={error.error.message}
            />
            <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-[18px]">
              <details className="group rounded-lg border border-line">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[12.5px] font-semibold text-ink">
                  <Icon
                    name="chevron_right"
                    size={18}
                    className="text-ink-muted transition-transform group-open:rotate-90"
                  />
                  Component stack
                </summary>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-line-soft bg-subtle p-3 font-mono text-[11.5px] text-ink-body">
                  {error.error.stack}
                </pre>
              </details>
            </div>
            <SlimDialogFooter>
              <Button onClick={() => setIsOpen(false)}>OK</Button>
            </SlimDialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const ErrorHandler = (
    error: Error,
    info: {
      componentStack: string
    },
  ): void => {
    /** Only log errors in development environment */
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, info)
    }
    /** In production, you might want to send this to an error reporting service */
  }

  return (
    <ErrorBoundary onError={ErrorHandler} FallbackComponent={ErrorFallback}>
      {children}
    </ErrorBoundary>
  )
}

export default CustomErrorBoundary
