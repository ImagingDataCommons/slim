/** Styles applied over DMV's hardcoded light legend chrome. */

export type DMVLegendAppearance = 'light' | 'dark'

const LIGHT = {
  rootBg: 'rgba(255, 255, 255, 0.94)',
  rootShadow: '0 1px 4px rgba(0, 0, 0, 0.12)',
  ink: 'rgba(15, 23, 36, 0.92)',
  inkMuted: 'rgba(15, 23, 36, 0.72)',
  chipBg: 'rgba(0, 0, 0, 0.04)',
  chipBorder: '1px solid rgba(0, 0, 0, 0.12)',
  chevronBg: 'rgba(0, 0, 0, 0.06)',
} as const

const DARK = {
  rootBg: 'rgba(21, 27, 38, 0.94)',
  rootShadow: '0 1px 4px rgba(0, 0, 0, 0.45)',
  ink: 'rgba(236, 240, 246, 0.94)',
  inkMuted: 'rgba(236, 240, 246, 0.78)',
  chipBg: 'rgba(255, 255, 255, 0.06)',
  chipBorder: '1px solid rgba(255, 255, 255, 0.12)',
  chevronBg: 'rgba(255, 255, 255, 0.08)',
} as const

type LegendPalette = typeof LIGHT | typeof DARK

function palette(appearance: DMVLegendAppearance): LegendPalette {
  return appearance === 'dark' ? DARK : LIGHT
}

function paintText(el: HTMLElement, colors: LegendPalette): void {
  /** Min/max ticks use the smaller DMV font; titles use full ink. */
  el.style.color = el.style.fontSize === '10px' ? colors.inkMuted : colors.ink
}

/**
 * Restyle the in-viewport SEG/PM legend that DMV paints with light-only
 * inline colors (`black`, `rgba(0,0,0,…)`) so it keeps contrast in both
 * Slim themes.
 */
export function applyDMVLegendTheme(
  root: HTMLElement,
  appearance: DMVLegendAppearance,
): void {
  const colors = palette(appearance)
  root.style.backgroundColor = colors.rootBg
  root.style.boxShadow = colors.rootShadow
  root.style.borderRadius = '8px'
  root.style.border =
    appearance === 'dark' ? colors.chipBorder : '1px solid transparent'
  root.style.color = colors.ink

  const header = root.querySelector(':scope > button')
  if (header instanceof HTMLElement) {
    header.style.background = colors.chipBg
    header.style.border = colors.chipBorder
    header.style.color = colors.ink
    for (const child of header.children) {
      if (!(child instanceof HTMLElement)) continue
      child.style.color = colors.inkMuted
      if (child.tagName === 'SPAN' && child !== header.firstElementChild) {
        child.style.background = colors.chevronBg
      }
    }
  }

  for (const el of root.querySelectorAll('div')) {
    if (!(el instanceof HTMLElement) || el === root) continue
    if (el.textContent === null || el.textContent.trim() === '') continue
    /** Skip flex row wrappers that only hold children */
    if (el.style.fontSize === '' && el.style.fontWeight === '') continue
    paintText(el, colors)
  }
}
