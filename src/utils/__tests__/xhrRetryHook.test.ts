import type { RetryRequestSettings } from '../../AppConfig'
import getXHRRetryHook from '../xhrRetryHook'

/**
 * Minimal XHR stand-in exposing only the surface the retry hook touches.
 * Each send() completes asynchronously with the next status from the queue,
 * mirroring how a real XHR invokes onreadystatechange at DONE.
 */
class FakeXHR {
  readyState = 0
  status = 0
  responseType: XMLHttpRequestResponseType = ''
  onreadystatechange: ((ev: Event) => void) | null = null
  statusQueue: number[] = []
  sendCount = 0
  openCalls: string[] = []
  headers: { [key: string]: string } = {}

  open(method: string, _url: string, _async: boolean): void {
    this.openCalls.push(method)
    /** A real XHR clears author request headers on open(). */
    this.headers = {}
  }

  setRequestHeader(key: string, value: string): void {
    this.headers[key] = value
  }

  send(): void {
    this.sendCount += 1
    const status = this.statusQueue.shift() ?? 200
    setTimeout(() => {
      this.readyState = XMLHttpRequest.DONE
      this.status = status
      this.onreadystatechange?.(new Event('readystatechange'))
    }, 0)
  }
}

const flush = async (ms = 50): Promise<void> => {
  return await new Promise((resolve) => setTimeout(resolve, ms))
}

const fastRetryOptions = {
  retries: 2,
  factor: 1,
  minTimeout: 1,
  maxTimeout: 1,
  randomize: false,
}

const applyHook = (
  xhr: FakeXHR,
  method: string,
  options: RetryRequestSettings = fastRetryOptions,
): void => {
  getXHRRetryHook(options)(xhr as unknown as XMLHttpRequest, {
    url: 'https://example.com/studies',
    method,
    headers: { Accept: 'application/dicom+json' },
  })
}

describe('getXHRRetryHook', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does not wrap send for non-idempotent methods', () => {
    const xhr = new FakeXHR()
    applyHook(xhr, 'POST')
    expect(Object.prototype.hasOwnProperty.call(xhr, 'send')).toBe(false)
  })

  it('passes a success straight through to the client handler', async () => {
    const xhr = new FakeXHR()
    xhr.statusQueue = [200]
    const clientHandler = jest.fn()
    xhr.onreadystatechange = clientHandler
    applyHook(xhr, 'GET')

    xhr.send()
    await flush()

    expect(xhr.sendCount).toBe(1)
    expect(clientHandler).toHaveBeenCalledTimes(1)
    expect(xhr.status).toBe(200)
  })

  it('does not retry non-retryable failure statuses', async () => {
    const xhr = new FakeXHR()
    xhr.statusQueue = [404]
    const clientHandler = jest.fn()
    xhr.onreadystatechange = clientHandler
    applyHook(xhr, 'GET')

    xhr.send()
    await flush()

    expect(xhr.sendCount).toBe(1)
    expect(clientHandler).toHaveBeenCalledTimes(1)
    expect(xhr.status).toBe(404)
  })

  it('re-sends on retryable statuses and only surfaces the final success', async () => {
    const xhr = new FakeXHR()
    xhr.statusQueue = [500, 429, 200]
    xhr.responseType = 'arraybuffer'
    const clientHandler = jest.fn()
    xhr.onreadystatechange = clientHandler
    applyHook(xhr, 'GET')

    xhr.send()
    await flush()

    expect(xhr.sendCount).toBe(3)
    /** The client handler must not observe the intermediate failures. */
    expect(clientHandler).toHaveBeenCalledTimes(1)
    expect(xhr.status).toBe(200)
    /** Retries re-open the request and restore headers and responseType. */
    expect(xhr.openCalls).toEqual(['GET', 'GET'])
    expect(xhr.headers).toEqual({ Accept: 'application/dicom+json' })
    expect(xhr.responseType).toBe('arraybuffer')
  })

  it('surfaces the final failure once retries are exhausted', async () => {
    const xhr = new FakeXHR()
    xhr.statusQueue = [500, 500, 500]
    const clientHandler = jest.fn()
    xhr.onreadystatechange = clientHandler
    applyHook(xhr, 'GET')

    xhr.send()
    await flush()

    /** Initial attempt plus the two configured retries. */
    expect(xhr.sendCount).toBe(3)
    expect(clientHandler).toHaveBeenCalledTimes(1)
    expect(xhr.status).toBe(500)
  })

  it('honors custom retryable status codes', async () => {
    const xhr = new FakeXHR()
    xhr.statusQueue = [500]
    const clientHandler = jest.fn()
    xhr.onreadystatechange = clientHandler
    applyHook(xhr, 'GET', { ...fastRetryOptions, retryableStatusCodes: [429] })

    xhr.send()
    await flush()

    /** 500 is not retryable under the custom configuration. */
    expect(xhr.sendCount).toBe(1)
    expect(clientHandler).toHaveBeenCalledTimes(1)
  })

  it('preserves onreadystatechange wrappers installed after the retry hook', async () => {
    const xhr = new FakeXHR()
    xhr.statusQueue = [0]
    const clientHandler = jest.fn()
    xhr.onreadystatechange = clientHandler
    applyHook(xhr, 'GET')

    /**
     * Mimic a later requestHook (e.g. Viv abort suppress) that wraps the
     * handler between retry-hook install and send().
     */
    const prev = xhr.onreadystatechange
    const laterWrapper = jest.fn(function (this: FakeXHR, ev: Event) {
      if (this.readyState === XMLHttpRequest.DONE && this.status === 0) {
        return
      }
      prev?.call(this, ev)
    })
    xhr.onreadystatechange = laterWrapper

    xhr.send()
    await flush()

    expect(laterWrapper).toHaveBeenCalledTimes(1)
    expect(clientHandler).not.toHaveBeenCalled()
  })
})
