import { useCallback, useEffect, useRef, useState } from 'react'

import { getClipboard, writeClipboardText } from '../utils/clipboard'

export interface UseCopyToClipboardReturn {
  /** True for `timeoutMs` after a successful copy */
  copied: boolean
  /** Copies `text`, resolving to whether it succeeded */
  copy: (text: string) => Promise<boolean>
}

export function useCopyToClipboard(timeoutMs = 1500): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const succeeded = await writeClipboardText(getClipboard(), text)
      clearTimeout(timer.current)
      setCopied(succeeded)
      if (succeeded) {
        timer.current = setTimeout(() => setCopied(false), timeoutMs)
      }
      return succeeded
    },
    [timeoutMs],
  )

  return { copied, copy }
}
