import { useEffect, useRef } from 'react'

export interface UseSuppressDMVDerivedLegendOptions {
  /** DMV segmentOverlay root; undefined until the volume viewer exists */
  getLegendRoot: () => HTMLElement | undefined
  /** Re-bind when the viewer instance is replaced */
  viewerKey: string
}

/**
 * Hide DMV's built-in SEG/PM legend while Slim renders its own DerivedLegend.
 * Needed until the published dicom-microscopy-viewer honors
 * `showDerivedLegend: false` (ImagingDataCommons/dicom-microscopy-viewer#296).
 * Safe to remove after that bump: the option then skips the overlay entirely.
 */
export function useSuppressDMVDerivedLegend({
  getLegendRoot,
  viewerKey,
}: UseSuppressDMVDerivedLegendOptions): void {
  const getLegendRootRef = useRef(getLegendRoot)

  useEffect(() => {
    getLegendRootRef.current = getLegendRoot
  }, [getLegendRoot])

  useEffect(() => {
    void viewerKey
    let observer: MutationObserver | undefined
    let retryId = 0
    let cancelled = false

    const suppress = (root: HTMLElement): void => {
      root.style.setProperty('display', 'none', 'important')
      root.replaceChildren()
    }

    const bind = (root: HTMLElement): void => {
      suppress(root)
      observer = new MutationObserver(() => {
        suppress(root)
      })
      observer.observe(root, { childList: true, subtree: true })
    }

    const root = getLegendRootRef.current()
    if (root !== undefined) {
      bind(root)
    } else {
      retryId = window.setInterval(() => {
        if (cancelled) return
        const next = getLegendRootRef.current()
        if (next === undefined) return
        window.clearInterval(retryId)
        retryId = 0
        bind(next)
      }, 200)
    }

    return () => {
      cancelled = true
      if (retryId !== 0) window.clearInterval(retryId)
      observer?.disconnect()
    }
  }, [viewerKey])
}
