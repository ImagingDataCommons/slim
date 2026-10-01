import type * as React from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { readStorage, writeStorage } from '../utils/safeStorage'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/** Also read by the pre-mount theme script in public/index.html */
const THEME_STORAGE_KEY = 'slim-theme'

interface ThemeContextValue {
  /** Current theme setting ('light', 'dark', or 'system') */
  theme: Theme
  /** Resolved theme based on system preference if theme is 'system' */
  resolvedTheme: ResolvedTheme
  /** Update the theme setting */
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

/** Null outside browsers and in environments without matchMedia */
function getDarkSchemeQuery(): MediaQueryList | null {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null
  }
  return window.matchMedia(DARK_SCHEME_QUERY)
}

function getSystemTheme(): ResolvedTheme {
  return getDarkSchemeQuery()?.matches === true ? 'dark' : 'light'
}

function getStoredTheme(): Theme | null {
  const stored = readStorage(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return null
}

interface ThemeProviderProps {
  children: React.ReactNode
  /** Default theme if no stored preference exists */
  defaultTheme?: Theme
  /** Force a specific theme (useful for testing) */
  forcedTheme?: ResolvedTheme
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  forcedTheme,
}: ThemeProviderProps): React.ReactElement {
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme() ?? defaultTheme
  })

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  useEffect(() => {
    const mediaQuery = getDarkSchemeQuery()
    if (mediaQuery === null) return
    const handleChange = (event: MediaQueryListEvent): void => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const resolvedTheme: ResolvedTheme =
    forcedTheme ?? (theme === 'system' ? systemTheme : theme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
    /** Native controls and scrollbars follow color-scheme */
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    writeStorage(THEME_STORAGE_KEY, newTheme)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Hook to access the current theme and theme controls.
 * Must be used within a ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
