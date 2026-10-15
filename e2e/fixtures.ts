import {
  type Browser,
  type BrowserContext,
  test as base,
  type Page,
} from '@playwright/test'

/**
 * Chromium composites in software here (SwiftShader), and the dialog scrim's
 * backdrop blur is recomputed over the full window on every frame. A dialog
 * left open at the end of a test kept the CPU at 100% until the next test
 * timed out creating its browser context, so the suite renders without it.
 */
async function disableBackdropFilters(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent =
        '*, *::before, *::after { backdrop-filter: none !important; }'
      document.head.append(style)
    })
  })
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await disableBackdropFilters(context)
    await use(context)
  },
})

/** A page for a serial group that shares one loaded slide across tests */
export async function newSharedPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  await disableBackdropFilters(context)
  return context.newPage()
}
