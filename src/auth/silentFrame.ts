import { isOidcAuthorizeCallbackUrl } from '../utils/url'

export const loadInHiddenFrame = (
  url: string,
  timeoutMs: number,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.visibility = 'hidden'
    frame.style.position = 'fixed'
    frame.style.left = '-1000px'
    frame.style.top = '0'
    frame.width = '0'
    frame.height = '0'

    const listeners = new AbortController()
    let timer = 0
    const cleanup = (): void => {
      window.clearTimeout(timer)
      listeners.abort()
      frame.remove()
    }
    const handleLoad = (): void => {
      let href: string | undefined
      try {
        href = frame.contentWindow?.location.href
      } catch {
        return
      }
      if (href === undefined || href === 'about:blank') {
        return
      }
      if (!isOidcAuthorizeCallbackUrl(new URL(href))) {
        return
      }
      cleanup()
      resolve(href)
    }
    timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('silent renew timed out'))
    }, timeoutMs)

    frame.addEventListener('load', handleLoad, { signal: listeners.signal })
    document.body.appendChild(frame)
    frame.src = url
  })
