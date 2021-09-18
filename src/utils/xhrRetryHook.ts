import retry from 'retry'

import {
  RetryRequestSettings,
  DICOMwebClientRequestHookMetadata
} from '../AppConfig'

type RequestHook = (
  request: XMLHttpRequest,
  metadata: DICOMwebClientRequestHookMetadata
) => XMLHttpRequest

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
export const getXHRRetryHook = (options: RetryRequestSettings = {
  retries: 5,
  factor: 3,
  minTimeout: 1 * 1000,
  maxTimeout: 60 * 1000,
  randomize: true,
  retryableStatusCodes: [429, 500]
}): RequestHook => {
  const retryOptions = options

  if (options.retries != null) {
    retryOptions.retries = options.retries
  }

  if (options.factor != null) {
    retryOptions.factor = options.factor
  }

  if (options.minTimeout != null) {
    retryOptions.minTimeout = options.minTimeout
  }

  if (options.maxTimeout != null) {
    retryOptions.maxTimeout = options.maxTimeout
  }

  if (options.randomize != null) {
    retryOptions.randomize = options.randomize
  }

  if (options.retryableStatusCodes != null) {
    retryOptions.retryableStatusCodes = options.retryableStatusCodes
  }

  /**
   * Request hook used to add retry functionality to XHR requests.
   *
   * @param request - XHR request instance
   * @param metadata - Metadata about the request
   * @param metadata.url - URL
   * @param metadata.method - HTTP method
   * @returns - XHR request instance (potentially modified)
   */
  const xhrRetryHook = (
    request: XMLHttpRequest,
    metadata: DICOMwebClientRequestHookMetadata
  ): XMLHttpRequest => {
    const { url, method } = metadata

    function faultTolerantRequestSend (...args: any): void {
      const operation = retry.operation(retryOptions)

      operation.attempt(function operationAttempt (currentAttempt) {
        const originalOnReadyStateChange = request.onreadystatechange

        /** Overriding/extending XHR function */
        request.onreadystatechange = function onReadyStateChange (...args: any): void {
          if (originalOnReadyStateChange != null) {
            originalOnReadyStateChange.apply(request, args)
          }

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
    const originalRequestSend = request.send
    request.send = faultTolerantRequestSend

    return request
  }

  return xhrRetryHook
}

export default getXHRRetryHook
