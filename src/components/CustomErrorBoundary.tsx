import { type ErrorInfo, type JSX, useState } from 'react'
import {
  ErrorBoundary,
  type FallbackProps,
  getErrorMessage,
} from 'react-error-boundary'

import { logger } from '../utils/logger'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  SlimDialogFooter,
  SlimDialogHeader,
} from './ui/dialog'
import { Icon } from './ui/icon'

function ErrorFallback({
  error,
  context,
}: FallbackProps & { context: string }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const stack = error instanceof Error ? error.stack : undefined

  return (
    <div>
      <p className="text-sm">
        There was an error in loading this page.{' '}
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent p-0 text-primary hover:underline"
          onClick={() => setIsOpen(true)}
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
            subtitle={getErrorMessage(error) ?? String(error)}
          />
          <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-[18px]">
            <details className="group rounded-lg border border-line">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[12.5px] font-semibold text-ink">
                <Icon
                  name="chevron_right"
                  size={18}
                  className="text-ink-muted transition-transform group-open:rotate-90"
                />
                Stack trace
              </summary>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-line-soft bg-subtle p-3 font-mono text-[11.5px] text-ink-body">
                {stack}
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

/**
 * React's error boundary component to catch errors during rendering phase
 * The fallback is rendered in the event of an error
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
  const ErrorHandler = (error: unknown, info: ErrorInfo): void => {
    if (import.meta.env.MODE === 'development') {
      logger.error('Error caught by boundary:', error, info)
    }
  }

  return (
    <ErrorBoundary
      onError={ErrorHandler}
      fallbackRender={(props) => <ErrorFallback {...props} context={context} />}
    >
      {children}
    </ErrorBoundary>
  )
}

export default CustomErrorBoundary
