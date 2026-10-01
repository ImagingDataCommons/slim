import { type ErrorInfo, type JSX, useState } from 'react'
import {
  ErrorBoundary,
  type FallbackProps,
  getErrorMessage,
} from 'react-error-boundary'

import { logger } from '../utils/logger'
import InfoPage from './InfoPage'
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
    <InfoPage
      type="error"
      title="Something went wrong"
      message={getErrorMessage(error) ?? String(error)}
    >
      <div className="mt-2 flex gap-2">
        <Button onClick={() => window.location.reload()}>
          <Icon name="refresh" size={16} />
          Reload page
        </Button>
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          Show details
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl">
          <SlimDialogHeader
            icon="error"
            title={`Unexpected error in the ${context} component`}
            subtitle={getErrorMessage(error) ?? String(error)}
          />
          <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-[18px]">
            <details className="group rounded-lg border border-line">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-12.5 font-semibold text-ink">
                <Icon
                  name="chevron_right"
                  size={18}
                  className="text-ink-muted transition-transform group-open:rotate-90"
                />
                Stack trace
              </summary>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-line-soft bg-subtle p-3 font-mono text-11.5 text-ink-body">
                {stack}
              </pre>
            </details>
          </div>
          <SlimDialogFooter>
            <Button onClick={() => setIsOpen(false)}>OK</Button>
          </SlimDialogFooter>
        </DialogContent>
      </Dialog>
    </InfoPage>
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
