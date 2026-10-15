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
  await expect(rows(page).first()).toBeVisible({ timeout: 60_000 })
}

test.describe('Worklist', () => {
  test('W1 lists slide microscopy studies with a count', async ({ page }) => {
    await openWorklist(page)
    await expect(
      page.getByText(/\d+ slide microscopy stud(y|ies)/),
    ).toBeVisible()
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
})
