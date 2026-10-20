import type * as React from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

/** Header and worklist chrome collapse below Tailwind `md`. */
export const COMPACT_CHROME_QUERY = '(max-width: 767.98px)'

/** Viewer rails become overlay sheets below Tailwind `lg`. */
export const OVERLAY_PANELS_QUERY = '(max-width: 1023.98px)'

/** Hover-only chrome is disabled on coarse pointers (phones, tablets). */
export const COARSE_POINTER_QUERY = '(pointer: coarse)'

export interface LayoutMode {
  compactChrome: boolean
  overlayPanels: boolean
  coarsePointer: boolean
}

export const DESKTOP_LAYOUT_MODE: LayoutMode = {
  compactChrome: false,
  overlayPanels: false,
  coarsePointer: false,
}

const LayoutModeContext = createContext<LayoutMode>(DESKTOP_LAYOUT_MODE)

/** Null outside browsers and in environments without matchMedia. */
function getMediaQuery(query: string): MediaQueryList | null {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null
  }
  return window.matchMedia(query)
}

export function readMediaQuery(query: string): boolean {
  return getMediaQuery(query)?.matches === true
}

export function readLayoutMode(): LayoutMode {
  return {
    compactChrome: readMediaQuery(COMPACT_CHROME_QUERY),
    overlayPanels: readMediaQuery(OVERLAY_PANELS_QUERY),
    coarsePointer: readMediaQuery(COARSE_POINTER_QUERY),
  }
}

function useTrackedMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => readMediaQuery(query))

  useEffect(() => {
    const mediaQuery = getMediaQuery(query)
    if (mediaQuery === null) return
    const handleChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches)
    }
    setMatches(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [query])

  return matches
}

interface LayoutModeProviderProps {
  children: React.ReactNode
  /** Override for tests so suites do not mock `window.matchMedia`. */
  value?: LayoutMode
}

export function LayoutModeProvider({
  children,
  value,
}: LayoutModeProviderProps): React.ReactElement {
  const compactChrome = useTrackedMediaQuery(COMPACT_CHROME_QUERY)
  const overlayPanels = useTrackedMediaQuery(OVERLAY_PANELS_QUERY)
  const coarsePointer = useTrackedMediaQuery(COARSE_POINTER_QUERY)
  const measured = useMemo<LayoutMode>(
    () => ({ compactChrome, overlayPanels, coarsePointer }),
    [compactChrome, overlayPanels, coarsePointer],
  )
  return (
    <LayoutModeContext.Provider value={value ?? measured}>
      {children}
    </LayoutModeContext.Provider>
  )
}

/** Current layout mode. Defaults to desktop when no provider is mounted. */
export function useLayoutMode(): LayoutMode {
  return useContext(LayoutModeContext)
}
