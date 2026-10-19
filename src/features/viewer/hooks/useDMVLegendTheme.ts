import { useEffect, useRef } from 'react'

import {
  applyDMVLegendTheme,
  type DMVLegendAppearance,
} from '../utils/dmvLegendTheme'

export interface UseDMVLegendThemeOptions {
  /** DMV segmentOverlay root; undefined until the volume viewer exists */
  getLegendRoot: () => HTMLElement | undefined
  appearance: DMVLegendAppearance
  /** Re-bind when the viewer instance is replaced */
  viewerKey: string
}

/**
 * Keep DMV's in-viewport SEG/PM legend styled for Slim light/dark chrome.
 * DMV rebuilds the legend DOM on visibility changes, so a MutationObserver
 * re-applies the theme after each sync.
 */
export function useDMVLegendTheme({
  getLegendRoot,
  appearance,
  viewerKey,
}: UseDMVLegendThemeOptions): void {
  const getLegendRootRef = useRef(getLegendRoot)

  useEffect(() => {
    getLegendRootRef.current = getLegendRoot
  }, [getLegendRoot])

  useEffect(() => {
    /** Reference keeps the effect keyed to viewer remounts for Biome. */
    void viewerKey
    let observer: MutationObserver | undefined
    let retryId = 0
    let cancelled = false

    const bind = (root: HTMLElement): void => {
      const paint = (): void => {
        applyDMVLegendTheme(root, appearance)
      }
      paint()
      /** childList only — observing style would loop with applyDMVLegendTheme */
      observer = new MutationObserver(paint)
      observer.observe(root, { childList: true, subtree: true })
    }

    const root = getLegendRootRef.current()
    if (root !== undefined) {
      bind(root)
    } else {
      /** Viewer can mount a tick after viewerKey updates */
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
  }, [appearance, viewerKey])
}
