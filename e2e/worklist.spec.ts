import { expect, type Page } from '@playwright/test'

import { test } from './fixtures'
import { slidePanel } from './helpers'
import { studies } from './studies'

function rows(page: Page) {
  return page.getByRole('table').getByRole('rowgroup').nth(1).getByRole('row')
}

async function openWorklist(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Studies' })).toBeVisible()
  /**
   * A study link, not just a row: the loading placeholder and the empty
   * state are rows too
   */
  await expect(rows(page).first().getByRole('link')).toBeVisible({
    timeout: 60_000,
  })
}

test.describe('Worklist', () => {
  test('W1 lists slide microscopy studies with a count', async ({ page }) => {
    await openWorklist(page)
    await expect(rows(page)).toHaveCount(20)
    await expect(page.getByText(/Showing 1–20 of \d+/)).toBeVisible()
  })

  test('W2 search narrows the list to matching studies', async ({ page }) => {
    await openWorklist(page)
    const patientId = (
      await rows(page).nth(3).getByRole('cell').nth(1).innerText()
    ).trim()
    await page
      .getByRole('searchbox', { name: 'Search studies' })
      .fill(patientId)
    await expect(page.getByText(/No studies match/)).toHaveCount(0)
    await expect(rows(page).first().getByRole('cell').nth(1)).toHaveText(
      patientId,
    )
    for (const row of await rows(page).all()) {
      await expect(row).toContainText(patientId)
    }
  })

  /** IDC returns at most 100 studies per query, so this needs the server search */
  test('W3 search finds a patient outside the first page of results', async ({
    page,
  }) => {
    await openWorklist(page)
    await page
      .getByRole('searchbox', { name: 'Search studies' })
      .fill(studies.he.patientId)
    await expect(
      rows(page).first().getByRole('link', { name: studies.he.patientId }),
    ).toBeVisible()
  })

  test('W4 sorting by Patient ID reorders rows', async ({ page }) => {
    await openWorklist(page)
    const patientIds = async () =>
      (await rows(page).all()).map((row) => row.getByRole('cell').nth(1))
    const header = page.getByRole('button', { name: 'Patient ID' })
    await header.click()
    const ascending = await Promise.all(
      (await patientIds()).map((cell) => cell.innerText()),
    )
    expect(ascending).toEqual([...ascending].sort((a, b) => a.localeCompare(b)))
    await header.click()
    const descending = await Promise.all(
      (await patientIds()).map((cell) => cell.innerText()),
    )
    expect(descending).not.toEqual(ascending)
  })

  test('W5 pagination moves between pages and changes page size', async ({
    page,
  }) => {
    await openWorklist(page)
    const firstRow = await rows(page).first().innerText()
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByText(/Showing 21–40 of/)).toBeVisible()
    await expect(rows(page).first()).not.toHaveText(firstRow)
    await page.getByRole('button', { name: 'Previous page' }).click()
    await expect(page.getByText(/Showing 1–20 of/)).toBeVisible()

    await page.getByRole('combobox', { name: 'Rows per page' }).click()
    await page.getByRole('option', { name: '50', exact: true }).click()
    await expect(rows(page)).toHaveCount(50)
  })

  test('W6 modalities fill in from series queries', async ({ page }) => {
    await openWorklist(page)
    await expect(rows(page).first().getByRole('cell').nth(4)).toHaveText(/SM/, {
      timeout: 60_000,
    })
  })

  test('W7 Contains filter narrows to studies with derived data', async ({
    page,
  }) => {
    await openWorklist(page)
    const annQueries: number[] = []
    page.on('response', (response) => {
      const url = decodeURIComponent(response.url())
      if (/Modality=ANN|1\.2\.840\.10008\.5\.1\.4\.1\.1\.91\.1/.test(url)) {
        annQueries.push(response.status())
      }
    })
    await page.getByRole('button', { name: 'Contains' }).click()
    await page
      .getByRole('option', { name: 'Bulk annotations, Annotations' })
      .click()
    await expect(page).toHaveURL(/[?&]contains=ann/)
    await expect(
      page.getByRole('button', { name: 'Contains Bulk annotations. Change' }),
    ).toBeVisible()
    await expect.poll(() => annQueries.includes(200)).toBe(true)
    await expect(rows(page).first().getByRole('link')).toBeVisible({
      timeout: 60_000,
    })

    await page
      .getByRole('button', { name: 'Clear Bulk annotations filter' })
      .click()
    await expect(page).not.toHaveURL(/contains=/)
  })

  test('W8 clicking a study opens the viewer and Worklist returns', async ({
    page,
  }) => {
    await openWorklist(page)
    await rows(page).first().getByRole('link').click()
    await expect(page).toHaveURL(/\/studies\/[\d.]+\/series\/[\d.]+/)
    await expect(slidePanel(page)).toBeVisible({ timeout: 60_000 })
    await page.getByRole('link', { name: 'Worklist' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Studies' })).toBeVisible()
  })

  test('W9 Compact rows tightens the table', async ({ page }) => {
    await openWorklist(page)
    await expect(rows(page).first().getByRole('link')).toBeVisible()
    const rowHeight = async () =>
      (await rows(page).first().boundingBox())?.height ?? 0
    const regular = await rowHeight()
    await page.getByRole('button', { name: /Guest/ }).click()
    await page.getByRole('menuitem', { name: 'Preferences' }).click()
    await page.getByRole('switch', { name: 'Compact rows' }).click()
    await page.getByRole('button', { name: 'Save preferences' }).click()
    await expect.poll(rowHeight).toBeLessThan(regular)
  })

  for (const { option, id } of [
    { option: 'Parametric map, Maps', id: 'pmap' },
    { option: 'Advanced blending, Presentation states', id: 'pr-blending' },
  ]) {
    const label = option.split(',')[0]
    test(`W10 Contains ${label} finds studies`, async ({ page }) => {
      await openWorklist(page)
      await page.getByRole('button', { name: 'Contains' }).click()
      await page.getByRole('option', { name: option, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`[?&]contains=${id}(&|$)`))
      await expect(
        page.getByRole('button', { name: `Contains ${label}. Change` }),
      ).toBeVisible()
      await expect(rows(page).first().getByRole('link')).toBeVisible({
        timeout: 60_000,
      })
    })
  }

  /** IDC holds thousands of SEG and SR series, so these searches outlast a test */
  for (const { option, id } of [
    { option: 'Segmentation, Segmentations', id: 'seg' },
    { option: '3D SR annotations, Annotations', id: 'sr3d' },
  ]) {
    const label = option.split(',')[0]
    test(`W10 Contains ${label} pages through the server`, async ({ page }) => {
      await openWorklist(page)
      await page.getByRole('button', { name: 'Contains' }).click()
      await page.getByRole('option', { name: option, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`[?&]contains=${id}(&|$)`))
      /**
       * The first page of matches is shown with Search more; asking for more
       * fetches the next page and the match count grows.
       */
      const partial = page.getByText(/first [\d,]+ matches only/)
      /** The count is formatted with thousands separators (1,000) */
      const matchCount = (text: string | null): number | undefined => {
        const digits = /first ([\d,]+) matches/.exec(text ?? '')?.[1]
        return digits === undefined
          ? undefined
          : Number(digits.replaceAll(',', ''))
      }
      await expect(partial).toBeVisible({ timeout: 60_000 })
      const firstCount = matchCount(await partial.innerText()) ?? 0
      await page.getByRole('button', { name: 'Search more' }).click()
      /** Once every match is in, the "first N" note goes away */
      await expect
        .poll(
          async () =>
            (await partial.count()) === 0
              ? Number.POSITIVE_INFINITY
              : (matchCount(await partial.textContent()) ?? 0),
          { timeout: 60_000 },
        )
        .toBeGreaterThan(firstCount)
    })
  }

  test('W11 sorting by Study date orders rows by date', async ({ page }) => {
    await openWorklist(page)
    await expect(rows(page).first().getByRole('link')).toBeVisible()
    const headers = page.getByRole('table').getByRole('columnheader')
    const names = await headers.allInnerTexts()
    const column = names.findIndex((name) => /^study date/i.test(name.trim()))
    expect(column, 'Study date column').toBeGreaterThan(-1)
    const studyDates = async () =>
      (
        await Promise.all(
          (
            await rows(page).all()
          ).map((row) => row.getByRole('cell').nth(column).innerText()),
        )
      )
        .map((text) => Date.parse(text))
        .filter((time) => !Number.isNaN(time))
    const direction = async () => {
      const dates = await studyDates()
      if (dates.every((date, i) => i === 0 || dates[i - 1] <= date)) {
        return 'ascending'
      }
      if (dates.every((date, i) => i === 0 || dates[i - 1] >= date)) {
        return 'descending'
      }
      return 'unsorted'
    }
    expect(new Set(await studyDates()).size).toBeGreaterThan(1)
    expect(await direction()).toBe('descending')
    await page.getByRole('button', { name: 'Patient ID' }).click()
    await expect.poll(direction).toBe('unsorted')
    await page.getByRole('button', { name: 'Study date' }).click()
    await expect.poll(direction).toBe('ascending')
  })

  test('W12 a search with no match says so', async ({ page }) => {
    await openWorklist(page)
    await page
      .getByRole('searchbox', { name: 'Search studies' })
      .fill('no-such-patient-e2e')
    await expect(page.getByText(/No studies match/)).toBeVisible({
      timeout: 60_000,
    })
    await expect(rows(page).getByRole('link')).toHaveCount(0)
  })

  test('W13 Enter on a focused study opens the viewer', async ({ page }) => {
    await openWorklist(page)
    await rows(page).first().getByRole('link').focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/studies\/[\d.]+\/series\/[\d.]+/)
    await expect(slidePanel(page)).toBeVisible({ timeout: 60_000 })
  })
})
