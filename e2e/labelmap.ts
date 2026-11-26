import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

import type { Page, Route } from '@playwright/test'

import { IDC_PROXY } from './helpers'
import { studies } from './studies'

/**
 * Synthetic LABELMAP Segmentation (e2e/data/labelmap/generate.py) of the RMS
 * slide in studies.rmsSr. IDC has no LABELMAP of a slide microscopy image,
 * so the spec serves this one from the IDC proxy URL as if it were part of
 * that study.
 */
const DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'data',
  'labelmap',
)

type DicomJson = Record<string, { vr: string; Value?: unknown[] }>

const metadata = JSON.parse(
  readFileSync(join(DATA_DIR, 'labelmap-seg.json'), 'utf8'),
) as DicomJson
const frames = gunzipSync(
  readFileSync(join(DATA_DIR, 'labelmap-seg-frames.bin.gz')),
)

function value(tag: string): string {
  return String(metadata[tag]?.Value?.[0] ?? '')
}

export const labelmap = {
  study: studies.rmsSr.study,
  series: value('0020000E'),
  instance: value('00080018'),
  /** Non-background segments, in Segment Number order */
  labels: ['NECROSIS', 'STROMA', 'ERMS', 'ARMS'],
} as const

const frameSize =
  Number(value('00280010')) *
  Number(value('00280011')) *
  (Number(value('00280100')) / 8)
const transferSyntax = value('00083002')
const studyBase = `${IDC_PROXY}/studies/${labelmap.study}`
const seriesBase = `${studyBase}/series/${labelmap.series}`
const instanceBase = `${seriesBase}/instances/${labelmap.instance}`

function pick(tags: readonly string[]): DicomJson {
  return Object.fromEntries(
    tags.filter((tag) => tag in metadata).map((tag) => [tag, metadata[tag]]),
  )
}

const SERIES_TAGS = [
  '00080020',
  '00080060',
  '0008103E',
  '0020000D',
  '0020000E',
  '00200011',
]
const INSTANCE_TAGS = [
  ...SERIES_TAGS,
  '00080016',
  '00080018',
  '00200013',
  '00280008',
  '00280010',
  '00280011',
]

const seriesResult = {
  ...pick(SERIES_TAGS),
  '00201209': { vr: 'IS', Value: [1] },
}
const instanceResult = pick(INSTANCE_TAGS)
const pixelDataUrl = `${instanceBase}/frames`

/** Instance metadata with Pixel Data pointing at the frames resource */
const instanceMetadata: DicomJson = {
  ...metadata,
  '7FE00010': { vr: 'OB', BulkDataURI: pixelDataUrl } as DicomJson[string],
}

/** Whether QIDO query parameters (keyword or tag) admit the fixture */
function matchesQuery(url: URL): boolean {
  const filters: Record<string, string> = {
    Modality: '00080060',
    SOPClassUID: '00080016',
    SeriesInstanceUID: '0020000E',
    SOPInstanceUID: '00080018',
  }
  for (const [keyword, tag] of Object.entries(filters)) {
    const wanted = url.searchParams.get(keyword) ?? url.searchParams.get(tag)
    if (wanted !== null && !wanted.split(',').includes(value(tag))) {
      return false
    }
  }
  return true
}

async function appendToUpstream(route: Route, extra: unknown): Promise<void> {
  const response = await route.fetch()
  if (!response.ok()) {
    /** Pass an upstream failure through, so a test fails on its cause */
    await route.fulfill({ response })
    return
  }
  const text = await response.text()
  const upstream = text.trim() === '' ? [] : (JSON.parse(text) as unknown[])
  await route.fulfill({
    response,
    status: 200,
    contentType: 'application/dicom+json',
    body: JSON.stringify([...upstream, extra]),
  })
}

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/dicom+json',
    body: JSON.stringify(body),
  })
}

/** Uncompressed frames, one part each, as a multipart/related response */
function frameResponse(
  route: Route,
  frameNumbers: readonly number[],
): Promise<void> {
  const boundary = 'slim-e2e-labelmap'
  const parts = frameNumbers.flatMap((frameNumber) => {
    const start = (frameNumber - 1) * frameSize
    return [
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Type: application/octet-stream; transfer-syntax=${transferSyntax}\r\n` +
          '\r\n',
      ),
      frames.subarray(start, start + frameSize),
      Buffer.from('\r\n'),
    ]
  })
  const body = Buffer.concat([...parts, Buffer.from(`--${boundary}--\r\n`)])
  return route.fulfill({
    status: 200,
    headers: {
      'Content-Type': `multipart/related; type="application/octet-stream"; boundary=${boundary}`,
    },
    body,
  })
}

/**
 * Adds the LABELMAP series to the RMS study on the IDC proxy: QIDO results
 * list it, metadata and frame requests for it are answered from the fixture,
 * and every other request goes to IDC unchanged.
 */
export async function serveLabelmap(page: Page): Promise<void> {
  await page.route(
    (url) => url.href.startsWith(studyBase),
    async (route) => {
      const url = new URL(route.request().url())
      const path = `${url.origin}${url.pathname}`
      /** One frame or a comma-separated list, as DICOMweb allows */
      const frame = path.match(/\/frames\/(\d+(?:,\d+)*)$/)
      if (path.startsWith(seriesBase)) {
        if (frame !== null) {
          await frameResponse(route, frame[1].split(',').map(Number))
        } else if (path.endsWith('/metadata')) {
          await json(route, [instanceMetadata])
        } else if (path === `${seriesBase}/instances`) {
          await json(route, matchesQuery(url) ? [instanceResult] : [])
        } else {
          await route.fulfill({ status: 404 })
        }
        return
      }
      if (path === `${studyBase}/series` && matchesQuery(url)) {
        await appendToUpstream(route, seriesResult)
      } else if (path === `${studyBase}/instances` && matchesQuery(url)) {
        await appendToUpstream(route, instanceResult)
      } else if (path === `${studyBase}/metadata`) {
        await appendToUpstream(route, instanceMetadata)
      } else {
        await route.continue()
      }
    },
  )
}
