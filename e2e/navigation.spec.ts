import { expect } from '@playwright/test'

import { test } from './fixtures'
import {
  configureDraw,
  expectTissueRendered,
  mainViewportCenter,
  openViewer,
  pressViewerShortcut,
  section,
  sectionButton,
  slidePanel,
  waitForTilesSettled,
} from './helpers'
import { seriesUrl, studies } from './studies'

const { he, tcgaRead } = studies

test.describe('Navigation', () => {
  test('V15 switching slides drops the previous slide ROIs, overlays and active tool', async ({
    page,
  }) => {
    await openViewer(
      page,
      seriesUrl({ study: tcgaRead.study, series: tcgaRead.fractionalTilSeg }),
    )
    const panel = slidePanel(page)
    const segments = await section(panel, 'Segmentations')
    /** The Series list shows the linked SEG, which the deep link turned on */
    await expect(
      segments.getByRole('button', { name: 'Show TILs Present' }),
    ).toHaveAttribute('aria-pressed', 'true')

    await pressViewerShortcut(page, 'KeyD')
    await configureDraw(page, 'Tumor', 'Point')
    const center = await mainViewportCenter(page)
    await page.mouse.click(center.x, center.y)
    await section(panel, 'Annotations')
    await expect(panel.getByRole('button', { name: /^ROI 1 / })).toBeVisible()

    const slides = page.getByRole('list', { name: 'Slides' })
    /** The SEG references the DX1 slide */
    const other = slides
      .getByRole('button')
      .filter({ hasNotText: 'DX1' })
      .first()
    await other.click()
    await expect(other).toHaveAttribute('aria-pressed', 'true')
    await expect(page).not.toHaveURL(new RegExp(tcgaRead.fractionalTilSeg))
    await waitForTilesSettled(page)

    await expect(
      page.getByRole('button', { name: 'Draw', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(sectionButton(panel, 'Annotations')).toHaveText(
      /Annotations\s*0/,
    )
    /** The other slides of this study have no segmentations */
    await expect(sectionButton(panel, 'Segmentations')).toHaveCount(0)
  })

  test('V16 Back returns to the worklist and Forward restores the last slide', async ({
    page,
  }) => {
    await page.goto('/')
    await page
      .getByRole('searchbox', { name: 'Search studies' })
      .fill(he.patientId)
    await page.getByRole('link', { name: he.patientId }).first().click()
    await expect(page).toHaveURL(new RegExp(`/studies/${he.study}/series/`))
    await expect(slidePanel(page)).toBeVisible({ timeout: 60_000 })

    const slides = page.getByRole('list', { name: 'Slides' })
    const [slideId] = (
      await slides.getByRole('button', { pressed: false }).first().innerText()
    ).split('\n')
    const other = slides.getByRole('button', {
      name: new RegExp(`^${slideId} `),
    })
    await other.click()
    await expect(other).toHaveAttribute('aria-pressed', 'true')
    const slideUrl = page.url()

    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Studies' })).toBeVisible()

    await page.goForward()
    await expect(page).toHaveURL(slideUrl)
    await expect(other).toHaveAttribute('aria-pressed', 'true', {
      timeout: 60_000,
    })
    await waitForTilesSettled(page)
    await expectTissueRendered(page)
  })
})
