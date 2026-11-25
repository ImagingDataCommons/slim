import { expect, type Locator, type Page } from '@playwright/test'

import { test } from './fixtures'
import {
  captureSettledViewport,
  expectTissueRendered,
  openViewer,
  section,
  slidePanel,
  waitForDeepLinkedLayer,
} from './helpers'
import { labelmap, serveLabelmap } from './labelmap'
import { seriesUrl } from './studies'

/** DMV draws a segment at 75 % opacity over the slide by default */
const SEGMENT_OPACITY = 0.75

const labelmapUrl = seriesUrl({
  study: labelmap.study,
  series: labelmap.series,
})

/** Segment labels in panel order, read from their visibility toggles */
async function listedLabels(segments: Locator): Promise<string[]> {
  const labels = await segments
    .getByRole('button', { name: /^Show (?!all)/ })
    .evaluateAll((toggles) =>
      toggles.map((toggle) => toggle.getAttribute('aria-label') ?? ''),
    )
  return labels.map((label) => label.replace(/^Show /, ''))
}

/** Swatch colors in panel order, as [r, g, b] */
async function swatchColors(segments: Locator): Promise<number[][]> {
  return segments
    .locator('[data-slot="segment-swatch"]')
    .evaluateAll((swatches) =>
      swatches.map((swatch) => {
        const match = getComputedStyle(swatch).backgroundColor.match(/\d+/g)
        return (match ?? []).slice(0, 3).map(Number)
      }),
    )
}

/**
 * Color a segment is drawn in: the pixels that changed between a capture
 * without and with the segment, unmixed from the slide underneath
 * (after = opacity * color + (1 - opacity) * before) and averaged.
 */
async function drawnColor(
  page: Page,
  before: Buffer,
  after: Buffer,
): Promise<number[]> {
  return page.evaluate(
    async ([encodedBefore, encodedAfter, opacity]) => {
      const decode = async (base64: string): Promise<Uint8ClampedArray> => {
        const blob = await (
          await fetch(`data:image/png;base64,${base64}`)
        ).blob()
        const bitmap = await createImageBitmap(blob)
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d')
        if (context === null) throw new Error('No 2D context')
        context.drawImage(bitmap, 0, 0)
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data
      }
      const [a, b] = await Promise.all([
        decode(encodedBefore as string),
        decode(encodedAfter as string),
      ])
      const sum = [0, 0, 0]
      let count = 0
      for (let i = 0; i < a.length; i += 4) {
        const change =
          Math.abs(a[i] - b[i]) +
          Math.abs(a[i + 1] - b[i + 1]) +
          Math.abs(a[i + 2] - b[i + 2])
        if (change < 60) continue
        for (let channel = 0; channel < 3; channel++) {
          const unmixed =
            (b[i + channel] - (1 - (opacity as number)) * a[i + channel]) /
            (opacity as number)
          sum[channel] += Math.min(255, Math.max(0, unmixed))
        }
        count++
      }
      return count === 0 ? [] : sum.map((total) => total / count)
    },
    [before.toString('base64'), after.toString('base64'), SEGMENT_OPACITY],
  )
}

function distance(a: number[], b: number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/**
 * Opacity a segment is drawn with: per changed pixel, how far it moved from
 * the slide towards the segment color, (after - before) / (color - before),
 * on the channel where color and slide differ most. Median over the pixels.
 */
async function blendOpacity(
  page: Page,
  before: Buffer,
  after: Buffer,
  color: number[],
): Promise<number> {
  return page.evaluate(
    async ([encodedBefore, encodedAfter, rgb]) => {
      const decode = async (base64: string): Promise<Uint8ClampedArray> => {
        const blob = await (
          await fetch(`data:image/png;base64,${base64}`)
        ).blob()
        const bitmap = await createImageBitmap(blob)
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d')
        if (context === null) throw new Error('No 2D context')
        context.drawImage(bitmap, 0, 0)
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data
      }
      const [a, b] = await Promise.all([
        decode(encodedBefore as string),
        decode(encodedAfter as string),
      ])
      const target = rgb as number[]
      const alphas: number[] = []
      for (let i = 0; i < a.length; i += 4) {
        let gap = 0
        let alpha = 0
        for (let channel = 0; channel < 3; channel++) {
          const channelGap = target[channel] - a[i + channel]
          if (Math.abs(channelGap) > Math.abs(gap)) {
            gap = channelGap
            alpha = (b[i + channel] - a[i + channel]) / channelGap
          }
        }
        /** Pixels the segment covers and where its color stands out */
        if (Math.abs(gap) > 60 && alpha > 0.1) alphas.push(alpha)
      }
      alphas.sort((x, y) => x - y)
      return alphas.length === 0 ? 0 : alphas[Math.floor(alphas.length / 2)]
    },
    [before.toString('base64'), after.toString('base64'), color],
  )
}

test.describe('LABELMAP segmentation', () => {
  test.beforeEach(async ({ page }) => {
    await serveLabelmap(page)
  })

  test('L1 background segment is neither listed nor shown by "Show all"', async ({
    page,
  }) => {
    await openViewer(page, labelmapUrl)
    await waitForDeepLinkedLayer(page, 'Segmentations')
    const segments = await section(slidePanel(page), 'Segmentations')

    expect(await listedLabels(segments)).toEqual([...labelmap.labels])
    await expect(segments.getByText('Background', { exact: true })).toHaveCount(
      0,
    )
    await expect(segments.getByText('4 of 4 visible')).toBeVisible()

    await segments.getByRole('button', { name: 'Hide all segments' }).click()
    await expect(segments.getByText('0 of 4 visible')).toBeVisible()
    await segments.getByRole('button', { name: 'Show all segments' }).click()
    await expect(segments.getByText('4 of 4 visible')).toBeVisible()
  })

  test('L2 each segment is drawn in the color of its swatch', async ({
    page,
  }) => {
    await openViewer(page, labelmapUrl)
    await expectTissueRendered(page)
    await waitForDeepLinkedLayer(page, 'Segmentations')
    const segments = await section(slidePanel(page), 'Segmentations')

    const swatches = await swatchColors(segments)
    expect(swatches).toHaveLength(labelmap.labels.length)
    /** Distinct colors: a shared fallback (all yellow) fails here */
    const distinct = new Set(swatches.map((color) => color.join(',')))
    expect(distinct.size, `swatches ${JSON.stringify(swatches)}`).toBe(
      labelmap.labels.length,
    )

    await segments.getByRole('button', { name: 'Hide all segments' }).click()
    await expect(segments.getByText('0 of 4 visible')).toBeVisible()
    const slideOnly = await captureSettledViewport(page)

    for (const [index, label] of labelmap.labels.entries()) {
      const toggle = segments.getByRole('button', {
        name: `Show ${label}`,
        exact: true,
      })
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-pressed', 'true')
      const drawn = await drawnColor(
        page,
        slideOnly,
        await captureSettledViewport(page),
      )
      expect(drawn, `${label} changed the viewport`).toHaveLength(3)
      const nearest = swatches.reduce(
        (best, color, candidate) =>
          distance(drawn, color) < distance(drawn, swatches[best])
            ? candidate
            : best,
        0,
      )
      expect(
        labelmap.labels[nearest],
        `${label} drawn as ${drawn.map(Math.round).join(',')}, swatch ${swatches[index].join(',')}`,
      ).toBe(label)
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    }
  })

  test('L3 a segment is drawn at the opacity its panel shows', async ({
    page,
  }) => {
    await openViewer(page, labelmapUrl)
    await expectTissueRendered(page)
    await waitForDeepLinkedLayer(page, 'Segmentations')
    const segments = await section(slidePanel(page), 'Segmentations')
    const [, swatch] = await swatchColors(segments)

    await segments.getByRole('button', { name: 'Hide all segments' }).click()
    await expect(segments.getByText('0 of 4 visible')).toBeVisible()
    const slideOnly = await captureSettledViewport(page)
    const toggle = segments.getByRole('button', {
      name: `Show ${labelmap.labels[1]}`,
      exact: true,
    })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(
      segments.getByRole('slider', {
        name: `Opacity of ${labelmap.labels[1]}`,
      }),
    ).toHaveAttribute('aria-valuenow', String(SEGMENT_OPACITY))

    /** dicom-microscopy-viewer before 0.51.3 drew it at 1 (fully opaque) */
    const opacity = await blendOpacity(
      page,
      slideOnly,
      await captureSettledViewport(page),
      swatch,
    )
    expect(opacity).toBeGreaterThan(SEGMENT_OPACITY - 0.05)
    expect(opacity).toBeLessThan(SEGMENT_OPACITY + 0.05)
  })
})
