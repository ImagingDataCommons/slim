import retry from 'retry'

import type {
  DICOMwebClientRequestHookMetadata,
  RetryRequestSettings,
} from '../AppConfig'

type RequestHook = (
  request: XMLHttpRequest,
  metadata: DICOMwebClientRequestHookMetadata,
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
export const getXHRRetryHook = (
  options: RetryRequestSettings = {
    retries: 5,
    factor: 3,
    minTimeout: 1 * 1000,
    maxTimeout: 60 * 1000,
    randomize: true,
    retryableStatusCodes: [429, 500],
  },
): RequestHook => {
  const retryOptions = {
    retries: options.retries ?? 5,
    factor: options.factor ?? 3,
    minTimeout: options.minTimeout ?? 1 * 1000,
    maxTimeout: options.maxTimeout ?? 60 * 1000,
    randomize: options.randomize ?? true,
    retryableStatusCodes: options.retryableStatusCodes ?? [429, 500],
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
  return (
    request: XMLHttpRequest,
    metadata: DICOMwebClientRequestHookMetadata,
  ): XMLHttpRequest => {
    const { url, method } = metadata
    const headers = metadata.headers ?? {}
    const originalRequestSend = request.send
    /** Captured before open() resets it on retry. */
    let responseType: XMLHttpRequestResponseType = request.responseType
    /** dicomweb-client handler installed before this hook runs. */
    const clientOnReadyStateChange = request.onreadystatechange

    function faultTolerantRequestSend(
      ...args: Parameters<XMLHttpRequest['send']>
    ): void {
      responseType = request.responseType
      const operation = retry.operation({
        retries: retryOptions.retries,
        factor: retryOptions.factor,
        minTimeout: retryOptions.minTimeout,
        maxTimeout: retryOptions.maxTimeout,
        randomize: retryOptions.randomize,
      })

      operation.attempt(function operationAttempt(currentAttempt) {
        if (currentAttempt > 1) {
          console.warn(`Requesting ${url}... (attempt: ${currentAttempt})`)
          // open() clears headers / responseType — restore what dicomweb-client set.
          request.open(method, url, true)
          request.responseType = responseType
          for (const key of Object.keys(headers)) {
            request.setRequestHeader(key, headers[key])
          }
        }

        request.onreadystatechange = function onReadyStateChange(
          ev: Event,
        ): void {
          if (request.readyState !== XMLHttpRequest.DONE) {
            return
          }

          if (
            retryOptions.retryableStatusCodes.includes(request.status) &&
            operation.retry(
              new Error(
                `Attempt to request ${url} failed (${request.status}).`,
              ),
            )
          ) {
            // Schedule another attempt; do not surface failure to dicomweb-client yet.
            return
          }

          if (clientOnReadyStateChange != null) {
            clientOnReadyStateChange.call(request, ev)
          }
        }

        originalRequestSend.apply(request, args)
      })
    }

    request.send = faultTolerantRequestSend

    return request
  }
}

export default getXHRRetryHook
