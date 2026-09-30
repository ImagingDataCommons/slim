import type * as React from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'slim-theme'

interface ThemeContextValue {
  /** Current theme setting ('light', 'dark', or 'system') */
  theme: Theme
  /** Resolved theme based on system preference if theme is 'system' */
  resolvedTheme: ResolvedTheme
  /** Update the theme setting */
  setTheme: (theme: Theme) => void
  /** Toggle between light and dark mode */
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
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
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light')
  }, [resolvedTheme, setTheme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme],
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

/**
 * Hook to check if the current theme is dark.
 * Useful for conditional rendering based on theme.
 */
export function useIsDarkTheme(): boolean {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'dark'
}
