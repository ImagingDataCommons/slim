/**
 * D9 — Save ROIs on the writable docker-compose archive and see them again
 * after reload. Requires:
 *
 *   docker compose up -d --build
 *   pnpm seed:local-archive
 *   pnpm test:e2e:local-archive
 *
 * Uses playwright.local-archive.config.ts (baseURL http://localhost:8008).
 * Skipped from the default IDC e2e project.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect } from '@playwright/test'

import { test } from './fixtures'
import {
  configureDraw,
  drawPolygon,
  openViewer,
  pressViewerShortcut,
  section,
  slidePanel,
} from './helpers'

const seedPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '.local-archive-seed.json',
)

function readSeed(): {
  studyInstanceUID: string
  seriesInstanceUID: string
} {
  if (!fs.existsSync(seedPath)) {
    throw new Error(
      `Missing ${seedPath}. Run: docker compose up -d --build && pnpm seed:local-archive`,
    )
  }
  return JSON.parse(fs.readFileSync(seedPath, 'utf8')) as {
    studyInstanceUID: string
    seriesInstanceUID: string
  }
}

test.describe('Local writable archive', () => {
  test('D9 Save ROIs and reload shows them as an SR', async ({ page }) => {
    test.setTimeout(180_000)
    const seed = readSeed()
    const slideUrl = `/studies/${seed.studyInstanceUID}/series/${seed.seriesInstanceUID}`
    await openViewer(page, slideUrl)
    await pressViewerShortcut(page, 'KeyD')
    await configureDraw(page, 'Tissue', 'Polygon')
    await drawPolygon(page)
    await page.keyboard.press('Escape')
    const rois = await section(slidePanel(page), 'Annotations')
    await expect(rois.getByRole('button', { name: /^ROI 1 / })).toBeVisible()

    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Save annotations')).toBeVisible()
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Annotations were saved.')).toBeVisible({
      timeout: 60_000,
    })

    await page.reload()
    await openViewer(page, slideUrl)
    const after = await section(slidePanel(page), 'Annotations')
    await expect(after.getByRole('button', { name: /^ROI 1 / })).toBeVisible({
      timeout: 90_000,
    })
  })
})
