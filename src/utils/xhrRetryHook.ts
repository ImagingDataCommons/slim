import retry from "retry"

export interface RetryOptions {
  retries: number
  factor: number
  minTimeout: number
  maxTimeout: number
  randomize: boolean
  retryableStatusCodes: number[]
}

export interface DWCRequestHookMetadata {
  url: string
  method: string
}

const defaultRetryOptions = {
  retries: 5,
  factor: 3,
  minTimeout: 1 * 1000,
  maxTimeout: 60 * 1000,
  randomize: true,
  retryableStatusCodes: [429, 500],
};

let retryOptions = { ...defaultRetryOptions }

/**
 * Request hook used to add retry functionality to XHR requests.
 *
 * @param request - XHR request instance
 * @param metadata - Metadata about the request
 * @param metadata.url - URL
 * @param metadata.method - HTTP method
 * @returns - XHR request instance (potentially modified)
 */
const xhrRetryHook = (request: XMLHttpRequest, metadata: DWCRequestHookMetadata) => {
  const { url, method } = metadata

  function faultTolerantRequestSend(...args: any) {
    const operation = retry.operation(retryOptions)

    operation.attempt(function operationAttempt(currentAttempt) {
      const noop = () => {}
      const originalOnReadyStateChange = request.onreadystatechange || noop

      /** Overriding/extending XHR function */
      request.onreadystatechange = function onReadyStateChange(...args: any) {
        originalOnReadyStateChange.apply(request, args);

        if (retryOptions.retryableStatusCodes.includes(request.status)) {
          const errorMessage = `Attempt to request ${url} failed.`
          const attemptFailedError = new Error(errorMessage)
          operation.retry(attemptFailedError)
        }
      }

      /** Call open only on retry (after headers and other things were set in the xhr instance) */
      if (currentAttempt > 1) {
        console.warn(`Requesting ${url}... (attempt: ${currentAttempt})`)
        request.open(method, url, true)
      }
    })

    originalRequestSend.apply(request, args)
  }

  /** Overriding/extending XHR function */
  const originalRequestSend = request.send;
  request.send = faultTolerantRequestSend;

  return request;
};

/**
 * Returns a configured retry request hook function
 * that can be used to add retry functionality to XHR request.
 *
 * Default options:
 *   retries: 5
 *   factor: 3
 *   minTimeout: 1 * 1000
 *   maxTimeout: 60 * 1000
 *   randomize: true
 *
 * @param options
 * @param options.retires - Number of retries
 * @param options.factor - Factor
 * @param options.minTimeout - Min number of seconds to wait before next retry
 * @param options.maxTimeout - Max number of seconds to wait before next retry
 * @param options.randomize - Whether randomization should be applied
 * @param options.retryableStatusCodes HTTP status codes that can trigger a retry
 * @returns Configured retry request function
 */
export const getXHRRetryHook = (options: RetryOptions = defaultRetryOptions) => {
  if ("retries" in options) {
    retryOptions.retries = options.retries
  }

  if ("factor" in options) {
    retryOptions.factor = options.factor
  }

  if ("minTimeout" in options) {
    retryOptions.minTimeout = options.minTimeout
  }

  if ("maxTimeout" in options) {
    retryOptions.maxTimeout = options.maxTimeout
  }

  if ("randomize" in options) {
    retryOptions.randomize = options.randomize
  }

  if ("retryableStatusCodes" in options) {
    retryOptions.retryableStatusCodes = options.retryableStatusCodes
  }

  return xhrRetryHook
};

export default getXHRRetryHook
