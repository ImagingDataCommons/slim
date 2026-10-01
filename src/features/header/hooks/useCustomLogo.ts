import { useEffect, useState } from 'react'

import { isUsableLogoSvg } from '../utils/customLogo'

/**
 * `url` once it is known to hold a usable logo, otherwise undefined. Any
 * fetch failure keeps the built-in logo.
 */
export function useCustomLogo(url: string): string | undefined {
  const [usableUrl, setUsableUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return undefined
        const markup = await response.text()
        return isUsableLogoSvg(response.headers.get('content-type'), markup)
          ? url
          : undefined
      })
      .then(
        (result) => {
          if (!controller.signal.aborted) setUsableUrl(result)
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
