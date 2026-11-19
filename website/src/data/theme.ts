/**
 * `<meta name="theme-color">` cannot read CSS variables, so these mirror the
 * `--app` token of each theme in src/styles/tokens.css. They are the only
 * colour literals allowed in the website; tests/no-raw-colors.test.mjs checks
 * that they still match the tokens.
 */
export const THEME_COLOR = {
  dark: '#0c1119',
  light: '#f2f4f7',
} as const

/** Same storage key as the app, so a choice made in Slim carries over */
export const THEME_STORAGE_KEY = 'slim-theme'
