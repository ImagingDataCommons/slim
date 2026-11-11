import { useEffect, useState } from 'react'

import { isUsableLogoSvg } from '../utils/customLogo'

/**
 * Whether each URL held a usable logo, kept for the page's lifetime: every
 * route renders its own header, and re-checking on each navigation would
 * flash the built-in logo first. Failed requests are not kept.
 */
const checkedLogos = new Map<string, boolean>()

/**
 * `url` once it is known to hold a usable logo, otherwise undefined. Any
 * fetch failure keeps the built-in logo.
 */
export function useCustomLogo(url: string): string | undefined {
  const [usableUrl, setUsableUrl] = useState<string | undefined>(() =>
    checkedLogos.get(url) === true ? url : undefined,
  )

  useEffect(() => {
    const checked = checkedLogos.get(url)
    if (checked !== undefined) {
      setUsableUrl(checked ? url : undefined)
      return
    }
    const controller = new AbortController()
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return false
        const markup = await response.text()
        return isUsableLogoSvg(response.headers.get('content-type'), markup)
      })
      .then(
        (isUsable) => {
          checkedLogos.set(url, isUsable)
          if (!controller.signal.aborted) {
            setUsableUrl(isUsable ? url : undefined)
          }
        },
        () => {
          if (!controller.signal.aborted) setUsableUrl(undefined)
        },
      )
    return () => {
      controller.abort()
    }
  }, [url])

  return usableUrl
}
