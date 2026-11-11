import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page } from '@playwright/test'

import { test } from './fixtures'
import { openViewer, overrideConfig, slidePanel } from './helpers'
import { studies } from './studies'

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function expectNoViolations(page: Page, include?: string): Promise<void> {
  const builder = new AxeBuilder({ page }).withTags(WCAG_AA)
  if (include !== undefined) {
    builder.include(include)
  }
  const { violations } = await builder.analyze()
  const summary = violations.map(
    ({ id, impact, nodes }) =>
      `${id} (${impact}): ${nodes.map((node) => `${node.html} ${node.failureSummary ?? ''}`).join(' | ')}`,
  )
  expect(summary).toEqual([])
}

function firstStudyLink(page: Page): Locator {
  return page
    .getByRole('table')
    .getByRole('rowgroup')
    .nth(1)
    .getByRole('link')
    .first()
}

test.describe('Accessibility', () => {
  test('X1 worklist has no WCAG AA violations', async ({ page }) => {
    await page.goto('/')
    await expect(firstStudyLink(page)).toBeVisible({ timeout: 60_000 })
    await expectNoViolations(page)
  })

  test('X2 viewer has no WCAG AA violations', async ({ page }) => {
    await openViewer(page, `/studies/${studies.he.study}`)
    await expect(slidePanel(page)).toBeVisible()
    await expectNoViolations(page)
  })

  test('X3 Preferences dialog has no WCAG AA violations', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Guest/ }).click()
    await page.getByRole('menuitem', { name: 'Preferences' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    /** Mid fade-in, axe blends colors and skips elements that are still transparent */
    await page.waitForFunction(
      () =>
        document
          .querySelector('[role="dialog"]')
          ?.getAnimations({ subtree: true }).length === 0,
    )
    await expectNoViolations(page, '[role="dialog"]')
  })

  test('X4 light theme viewer has no WCAG AA violations', async ({ page }) => {
    await overrideConfig(page, { mode: 'light' })
    await openViewer(page, `/studies/${studies.he.study}`)
    await expect(page.locator('html')).toHaveClass(/light/)
    await expectNoViolations(page)
  })

  test('X5 light theme worklist has no WCAG AA violations', async ({
    page,
  }) => {
    await overrideConfig(page, { mode: 'light' })
    await page.goto('/')
    await expect(firstStudyLink(page)).toBeVisible({ timeout: 60_000 })
    await expectNoViolations(page)
  })
})
