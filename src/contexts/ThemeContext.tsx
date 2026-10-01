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

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
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
  defaultTheme = 'light',
  forcedTheme,
}: ThemeProviderProps): React.ReactElement {
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme() ?? defaultTheme
  })

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  /** Listen for system theme changes */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent): void => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    if (forcedTheme) return forcedTheme
    if (theme === 'system') return systemTheme
    return theme
  }, [theme, systemTheme, forcedTheme])

  /** Apply theme class to document */
  useEffect(() => {
    const root = document.documentElement

    /** Remove both classes first */
    root.classList.remove('light', 'dark')

    /** Add the resolved theme class */
    root.classList.add(resolvedTheme)

    /** Update color-scheme for native elements */
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
