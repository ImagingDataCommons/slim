import { Modal, Collapse } from 'antd'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import { useCallback } from 'react'

/**
 * React's error boundary component to catch errors during rendering phase
 * FallbackComponent is rendered in the event of an error
 *
 * @param context - name of the react component
 * @param children - the component wrapped inside the Custom Error Boundary
 */
const CustomErrorBoundary = ({
  context,
  children
}: {
  context: string
  children: JSX.Element
}): JSX.Element => {
  const { Panel } = Collapse
  const ErrorFallback = (error: FallbackProps): JSX.Element => {
    const openModal = useCallback((): void => {
      Modal.error({
        title: (
          <>
            <h1>An unexpected error occured in the {context} component</h1>
            <p>{error.error.message}</p>
          </>
        ),
        width: 800,
        content: (
          <>
            <Collapse>
              <Panel header='Component Stack' key='stack1'>
                {error.error.stack}
              </Panel>
            </Collapse>
          </>
        ),
        onOk (): void {}
      })
    }, [error.error.message, error.error.stack])

    const handleClick = useCallback((): void => {
      openModal()
    }, [openModal])

    const handleKeyDown = useCallback((event: React.KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openModal()
      }
    }, [openModal])

    return (
      <div>
        <p>
          There was an error in loading this page.{' '}
          <span
            style={{ cursor: 'pointer', color: '#0077FF' }}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role='button'
            aria-label='Show error details'
          >
            Click for error details
          </span>{' '}
        </p>
      </div>
    )
  }

  const ErrorHandler = (
    error: Error,
    info: {
      componentStack: string
    }
  ): void => {
    console.error(error)
  }

  return (
    <ErrorBoundary onError={ErrorHandler} FallbackComponent={ErrorFallback}>
      {children}
    </ErrorBoundary>
  )
}

export default CustomErrorBoundary
