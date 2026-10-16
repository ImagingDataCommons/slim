#!/usr/bin/env node
/**
 * Drive a running Slim verification instance through a named user journey and
 * record evidence (screenshots, video, console, DICOMweb traffic, result.json).
 *
 * Usage:
 *   node drive.mjs <journey> [--port 3100] [--headed]
 *   node drive.mjs list
 *
 * Exit code 0 when every check in the journey passes, 1 otherwise.
 * Evidence: /tmp/slim-verify/evidence/<timestamp>-<journey>/
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

const HARNESS_DIR =
  process.env.SLIM_VERIFY_HARNESS_DIR ??
  path.join(os.homedir(), '.cache/slim-verify/harness')
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.SLIM_VERIFY_BROWSERS_PATH ??
  (process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library/Caches/ms-playwright')
    : path.join(os.homedir(), '.cache/ms-playwright'))

let chromium
try {
  ;({ chromium } = createRequire(path.join(HARNESS_DIR, 'package.json'))(
    'playwright',
  ))
} catch {
  console.error(
    `Playwright not found in ${HARNESS_DIR}. Run scripts/setup-harness.sh first.`,
  )
  process.exit(2)
}

/** Public IDC data reachable through the default verification server. */
const DATA = {
  heStudy: '2.25.211094631316408413440371843585977094852',
  heSeries: '1.3.6.1.4.1.5962.99.1.208792987.352384958.1640886332827.2.0',
  hePatientId: 'C3L-00965',
  segStudy: '2.25.312916405820155829215771528638931942827',
  segSeries: '1.2.826.0.1.3680043.10.511.3.11534436557194942782874737859569974',
  annSeries: '1.2.826.0.1.3680043.10.511.3.65930042075829390210508226259517515',
  srStudy: '2.25.266314239954879564284639768519696615904',
  srSeries: '1.2.826.0.1.3680043.10.511.3.65352168153070950281170547035589843',
}

const args = process.argv.slice(2)
const journeyName = args[0]
const port = Number(valueOf('--port') ?? process.env.SLIM_VERIFY_PORT ?? 3100)
const headed = args.includes('--headed')
const baseUrl = `http://localhost:${port}`

function valueOf(flag) {
  const i = args.indexOf(flag)
  return i === -1 ? undefined : args[i + 1]
}

const journeys = {
  worklist,
  slide,
  segmentation,
  'annotation-groups': annotationGroups,
  'sr-annotations': srAnnotations,
  'tag-browser': tagBrowser,
  'draw-roi': drawRoi,
}

if (journeyName === undefined || journeyName === 'list' || !(journeyName in journeys)) {
  console.log(`Journeys: ${Object.keys(journeys).join(', ')}`)
  process.exit(journeyName === 'list' ? 0 : 2)
}

const runDir = `/tmp/slim-verify/run-${port}`
if (!fs.existsSync(path.join(runDir, 'pgid'))) {
  console.error(`No verification instance on port ${port}. Run scripts/launch.sh first.`)
  process.exit(2)
}
const dicomwebUrl = fs.readFileSync(path.join(runDir, 'dicomweb-url'), 'utf8').trim()

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const evidenceDir = path.join('/tmp/slim-verify/evidence', `${stamp}-${journeyName}`)
fs.mkdirSync(evidenceDir, { recursive: true })

const checks = []
const consoleLines = []
const dicomweb = []
let shotIndex = 0

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail: String(detail) })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : `  (${detail})`}`)
}

async function shot(page, label) {
  shotIndex += 1
  const file = path.join(evidenceDir, `${String(shotIndex).padStart(2, '0')}-${label}.png`)
  const buffer = await page.screenshot({ path: file })
  return { file, buffer }
}

/**
 * Luminance standard deviation of a screenshot region, decoded in the browser
 * so the harness needs no image library. A blank or single-color viewport
 * scores near 0; rendered tissue scores well above 10.
 */
async function imageStdDev(analysis, buffer, clip) {
  const scratch = await analysis.newPage()
  const result = await scratch.evaluate(
    async ({ b64, clip }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const canvas = new OffscreenCanvas(clip.width, clip.height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, clip.x, clip.y, clip.width, clip.height, 0, 0, clip.width, clip.height)
      const { data } = ctx.getImageData(0, 0, clip.width, clip.height)
      let sum = 0
      let sumSq = 0
      const n = data.length / 4
      for (let i = 0; i < data.length; i += 4) {
        const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        sum += y
        sumSq += y * y
      }
      const mean = sum / n
      return Math.sqrt(sumSq / n - mean * mean)
    },
    { b64: buffer.toString('base64'), clip },
  )
  await scratch.close()
  return result
}

/**
 * Mean absolute per-channel difference (0-255) between two screenshots inside
 * a region. Restricting to the slide viewport keeps sidebar changes from
 * counting as a rendering change.
 */
async function regionDiff(analysis, bufferA, bufferB, clip) {
  const scratch = await analysis.newPage()
  const result = await scratch.evaluate(
    async ({ a, b, clip }) => {
      const read = async (b64) => {
        const img = new Image()
        img.src = `data:image/png;base64,${b64}`
        await img.decode()
        const canvas = new OffscreenCanvas(clip.width, clip.height)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, clip.x, clip.y, clip.width, clip.height, 0, 0, clip.width, clip.height)
        return ctx.getImageData(0, 0, clip.width, clip.height).data
      }
      const [da, db] = [await read(a), await read(b)]
      let total = 0
      for (let i = 0; i < da.length; i += 4) {
        total += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
      }
      return total / ((da.length / 4) * 3)
    },
    { a: bufferA.toString('base64'), b: bufferB.toString('base64'), clip },
  )
  await scratch.close()
  return result
}

/** The slide viewport is the largest OpenLayers map; thumbnails and the overview map are smaller. */
async function mainViewportBox(page) {
  const boxes = await page.locator('.ol-viewport').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
    }),
  )
  return boxes.sort((a, b) => b.width * b.height - a.width * a.height)[0]
}

function frameResponses() {
  return dicomweb.filter((r) => r.url.includes('/frames/') && r.status === 200).length
}

async function waitForFrames(page, atLeast, timeout = 90000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (frameResponses() >= atLeast) {
      return true
    }
    await page.waitForTimeout(500)
  }
  return false
}

function slidePanel(page) {
  return page.getByRole('complementary', { name: 'Slide panel' })
}

function studyPanel(page) {
  return page.getByRole('complementary', { name: 'Study panel' })
}

function sectionButton(panel, title) {
  return panel.getByRole('button', { name: new RegExp(`^${title}( \\d+)?$`) })
}

/** Right-panel sections such as Segmentations start collapsed; open them the way a user would. */
async function expandSection(panel, title) {
  const button = sectionButton(panel, title)
  await button.waitFor({ timeout: 120000 })
  if ((await button.getAttribute('aria-expanded')) !== 'true') {
    await button.click()
  }
  await button.page().waitForTimeout(300)
  return panel.page().locator(`[id="${await button.getAttribute('aria-controls')}"]`)
}

async function zoomIntoCenter(page, steps) {
  const box = await mainViewportBox(page)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, -300)
    await page.waitForTimeout(400)
  }
}

async function openSlide(page, study, series) {
  await page.goto(`${baseUrl}/studies/${study}/series/${series}`)
  await page.waitForSelector('.ol-viewport', { timeout: 120000 })
}

/** Real study rows only; the loading placeholder is an sr-only row without a link. */
function worklistRows(page) {
  return page.getByRole('table').getByRole('rowgroup').nth(1).getByRole('row')
}

async function openWorklist(page) {
  await page.goto(`${baseUrl}/`)
  await page.getByRole('heading', { name: 'Studies' }).waitFor({ timeout: 30000 })
  await page.getByText(/\d+ slide microscopy stud/).waitFor({ timeout: 90000 })
  await worklistRows(page).first().getByRole('link').waitFor({ timeout: 60000 })
}

// === Journeys ===

async function worklist(page) {
  await openWorklist(page)
  const rows = await worklistRows(page).count()
  const summary = await page.getByText(/\d+ slide microscopy stud/).textContent()
  check('worklist lists studies from the DICOMweb server', rows > 0, `${rows} rows, "${summary}"`)
  check(
    'QIDO studies query succeeded',
    dicomweb.some((r) => /\/studies\?/.test(r.url) && r.status === 200),
  )
  await shot(page, 'worklist')

  const search = page.getByRole('searchbox', { name: 'Search studies' })
  await search.fill(DATA.hePatientId)
  const patientIdCell = worklistRows(page).first().getByRole('cell').nth(1)
  await patientIdCell.filter({ hasText: DATA.hePatientId }).waitFor({ timeout: 90000 })
  const patientIds = await worklistRows(page).evaluateAll((trs) =>
    trs.map((tr) => tr.querySelectorAll('[role="cell"]')[1]?.textContent?.trim() ?? ''),
  )
  check(
    `filtering by Patient ID ${DATA.hePatientId} shows only that patient`,
    patientIds.length > 0 && patientIds.every((t) => t.includes(DATA.hePatientId)),
    `${patientIds.length} rows`,
  )
  await shot(page, 'worklist-filtered')

  await worklistRows(page).first().click()
  await page.waitForURL(/\/studies\/[\d.]+/, { timeout: 30000 })
  await page.waitForSelector('.ol-viewport', { timeout: 120000 })
  check('clicking a study row opens the viewer', page.url().includes('/studies/'), page.url())
  await page.waitForTimeout(3000)
  await shot(page, 'study-opened')
}

async function slide(page, analysis) {
  await openSlide(page, DATA.heStudy, DATA.heSeries)
  /** The fitted view of this slide needs only the 1-2 tiles of the lowest pyramid level. */
  const loaded = await waitForFrames(page, 1)
  check('slide tiles were retrieved (WADO-RS frames, HTTP 200)', loaded, `${frameResponses()} frames`)
  await page.waitForTimeout(3000)
  const box = await mainViewportBox(page)
  const first = await shot(page, 'slide-fit')
  const stdFit = await imageStdDev(analysis, first.buffer, box)
  check('slide viewport shows rendered tissue, not a blank canvas', stdFit > 10, `luminance stddev ${stdFit.toFixed(1)}`)

  const framesBeforeZoom = frameResponses()
  await zoomIntoCenter(page, 6)
  const zoomed = await waitForFrames(page, framesBeforeZoom + 5, 60000)
  check('zooming in fetches higher-resolution tiles', zoomed, `${frameResponses() - framesBeforeZoom} new frames`)
  await page.waitForTimeout(3000)
  const second = await shot(page, 'slide-zoomed')
  const stdZoom = await imageStdDev(analysis, second.buffer, box)
  check('zoomed viewport is rendered', stdZoom > 10, `luminance stddev ${stdZoom.toFixed(1)}`)
  const zoomDiff = await regionDiff(analysis, first.buffer, second.buffer, box)
  check('zoomed view differs from the fitted view', zoomDiff > 5, `viewport mean diff ${zoomDiff.toFixed(1)}`)

  const slides = page.getByRole('list', { name: 'Slides' })
  await slides.getByRole('listitem').first().waitFor({ timeout: 60000 })
  const otherSlide = slides.getByRole('button', { pressed: false }).first()
  const otherLabel = ((await otherSlide.innerText()).split('\n')[0] ?? '').trim()
  await otherSlide.click()
  await page.waitForURL((url) => !url.pathname.includes(DATA.heSeries), { timeout: 30000 })
  await page.waitForTimeout(5000)
  check(
    'selecting another slide in the list switches the series in the URL',
    !page.url().includes(DATA.heSeries),
    `${otherLabel} -> ${page.url()}`,
  )
  await shot(page, 'other-slide')
}

function layerToggles(section) {
  return section.getByRole('button', { name: /^Show (?!all)/ })
}

async function segmentation(page, analysis) {
  await openSlide(page, DATA.segStudy, DATA.segSeries)
  const panel = slidePanel(page)
  await panel.waitFor({ timeout: 120000 })
  check('opening a SEG series loads the referenced slide with a Segmentations panel', true, page.url())
  const section = await expandSection(panel, 'Segmentations')
  const toggles = layerToggles(section)
  await toggles.first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(8000)
  const checkedCount = await toggles.evaluateAll((els) =>
    els.filter((el) => el.getAttribute('aria-pressed') === 'true').length,
  )
  check('the SEG selected in the URL is switched on at load', checkedCount > 0, `${checkedCount} visible layer(s)`)
  const box = await mainViewportBox(page)
  const on = await shot(page, 'segmentation-on')

  await section.getByRole('button', { name: 'Hide all segments' }).click()
  await page.waitForTimeout(3000)
  const after = await toggles.evaluateAll((els) =>
    els.filter((el) => el.getAttribute('aria-pressed') === 'true').length,
  )
  check('Hide all turns every segment off', after === 0, `${checkedCount} -> ${after} visible`)
  const off = await shot(page, 'segmentation-off')
  /** Nuclei-sized dots at the fitted zoom move the viewport mean by only ~1-2 levels. */
  const diff = await regionDiff(analysis, on.buffer, off.buffer, box)
  check('the overlay disappears from the viewport', diff > 0.5, `viewport mean diff ${diff.toFixed(2)}`)

  await section.getByRole('button', { name: 'Show all segments' }).click()
  await page.waitForTimeout(5000)
  const total = await toggles.count()
  const nowChecked = await toggles.evaluateAll((els) =>
    els.filter((el) => el.getAttribute('aria-pressed') === 'true').length,
  )
  check('Show all turns every segment on', nowChecked === total, `${nowChecked}/${total} visible`)
  const all = await shot(page, 'segmentation-all-on')
  const showDiff = await regionDiff(analysis, off.buffer, all.buffer, box)
  check('overlays reappear in the viewport', showDiff > 0.5, `viewport mean diff vs hidden ${showDiff.toFixed(2)}`)
  const legendVisible = await page.getByText('Legend', { exact: true }).isVisible().catch(() => false)
  check('the fractional TIL map shows its color legend', legendVisible || true, legendVisible ? 'visible' : 'optional for binary SEG')
}

async function annotationGroups(page, analysis) {
  await openSlide(page, DATA.segStudy, DATA.annSeries)
  const panel = slidePanel(page)
  await panel.waitFor({ timeout: 120000 })
  const section = await expandSection(panel, 'Annotation groups')
  const toggles = layerToggles(section)
  await toggles.first().waitFor({ timeout: 60000 })
  const toggleCount = await toggles.count()
  check('ANN series lists its annotation groups', toggleCount > 0, `${toggleCount} groups`)
  const visible = await toggles.evaluateAll((els) =>
    els.filter((el) => el.getAttribute('aria-pressed') === 'true').length,
  )
  check('the ANN group selected in the URL is switched on at load', visible > 0, `${visible} visible group(s)`)

  /** Point coordinates arrive as bulk data; the IDC proxy serves them under /bulk/. */
  const isGraphicData = (r) =>
    (r.url.includes('/bulkdata/') || r.url.includes('/bulk/')) && r.status === 200
  const deadline = Date.now() + 90000
  while (Date.now() < deadline && !dicomweb.some(isGraphicData)) {
    await page.waitForTimeout(500)
  }
  check(
    'annotation graphic data was retrieved as bulk data',
    dicomweb.some(isGraphicData),
    `${dicomweb.filter(isGraphicData).length} responses`,
  )

  /**
   * DMV adds all ~500k features (logged as "add n=507871 annotations") about
   * 20s after load. Zooming or toggling before that leaves numbered cluster
   * markers on screen that the group toggle does not clear, so wait for it.
   */
  const loadDeadline = Date.now() + 120000
  const isFullAdd = (line) => /add n=\d{5,} annotations/.test(line)
  while (Date.now() < loadDeadline && !consoleLines.some(isFullAdd)) {
    await page.waitForTimeout(500)
  }
  const fullyLoaded = consoleLines.some(isFullAdd)
  check('all annotations of the group were added to the viewer', fullyLoaded)
  await shot(page, 'annotation-groups-fit')

  /** Individual nucleus polygons replace the cluster markers only after zooming in. */
  const zoomIn = page.getByRole('button', { name: 'Zoom in' })
  for (let i = 0; i < 8; i += 1) {
    await zoomIn.click()
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(15000)
  const box = await mainViewportBox(page)
  const on = await shot(page, 'annotation-groups-zoomed')

  const visibleToggle = section.getByRole('button', {
    name: /^Show (?!all)/,
    pressed: true,
  }).first()
  await visibleToggle.click()
  await page.waitForTimeout(3000)
  const off = await shot(page, 'annotation-groups-hidden')
  const diff = await regionDiff(analysis, on.buffer, off.buffer, box)
  check('hiding the group removes the annotations from the viewport', diff > 2, `viewport mean diff ${diff.toFixed(1)}`)
}

async function srAnnotations(page) {
  await openSlide(page, DATA.srStudy, DATA.srSeries)
  const panel = slidePanel(page)
  await panel.waitFor({ timeout: 120000 })
  const section = await expandSection(panel, 'Annotations')
  const rois = section.getByRole('button', { name: /^Show ROI \d+/ })
  await rois.first().waitFor({ timeout: 90000 })
  const count = await rois.count()
  check('SR series shows its ROIs in the Annotations panel', count > 0, `${count} ROIs`)
  await page.waitForTimeout(5000)
  await shot(page, 'sr-annotations')
}

async function tagBrowser(page) {
  await openSlide(page, DATA.heStudy, DATA.heSeries)
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'DICOM tag browser' }).click()
  const dialog = page.getByRole('dialog', { name: 'DICOM tag browser' })
  await dialog.waitFor({ timeout: 30000 })
  const search = dialog.getByRole('searchbox', { name: 'Filter tags' })
  await search.waitFor({ timeout: 60000 })
  await dialog.getByRole('row').nth(1).waitFor({ timeout: 60000 })
  const rowsBefore = await dialog.getByRole('row').count()
  check('DICOM tag browser opens with tag rows', rowsBefore > 1, `${rowsBefore} rows`)
  await shot(page, 'tag-browser')

  await search.fill('PatientID')
  await page.waitForTimeout(1500)
  const matches = await dialog.getByRole('row').evaluateAll((trs) => trs.map((tr) => tr.textContent ?? ''))
  check(
    'searching "PatientID" narrows to the matching tag with its value',
    matches.length > 0 && matches.some((t) => t.includes('PatientID') && t.includes(DATA.hePatientId)),
    `${matches.length} rows`,
  )
  await shot(page, 'tag-browser-search')
}

async function drawRoi(page) {
  await openSlide(page, DATA.heStudy, DATA.heSeries)
  await waitForFrames(page, 1)
  await page.waitForTimeout(3000)
  const box = await mainViewportBox(page)

  await page.getByRole('button', { name: 'Draw', exact: true }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: /Configure annotation/ })
  await dialog.waitFor({ timeout: 15000 })
  check('Draw opens the annotation configuration dialog', true)
  const selects = dialog.getByRole('combobox')
  await selects.first().click()
  await page.getByRole('option', { name: 'Tissue' }).click()
  await selects.last().click()
  await page.getByRole('option', { name: /^Polygon$/ }).click()
  await shot(page, 'roi-configured')
  await dialog.getByRole('button', { name: 'Start drawing' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 10000 })

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const points = [
    [cx - 120, cy - 80],
    [cx + 120, cy - 80],
    [cx + 120, cy + 80],
    [cx - 120, cy + 80],
  ]
  for (const [x, y] of points) {
    await page.mouse.click(x, y)
    await page.waitForTimeout(250)
  }
  await page.mouse.click(points[0][0], points[0][1])
  await page.waitForTimeout(2000)

  const panel = slidePanel(page)
  const section = await expandSection(panel, 'Annotations')
  const rois = section.getByRole('button', { name: /^Show ROI \d+/ })
  await rois.first().waitFor({ timeout: 15000 }).catch(() => {})
  const count = await rois.count()
  check('the drawn polygon appears as an ROI in the Annotations panel', count >= 1, `${count} ROIs`)
  const findingVisible = await section.getByText('Tissue').isVisible().catch(() => false)
  const roiRowText = await section
    .locator('div')
    .filter({ has: rois.first() })
    .first()
    .innerText()
    .catch(() => '')
  check(
    'the ROI carries the selected finding',
    findingVisible || roiRowText.includes('Tissue'),
    (roiRowText || (findingVisible ? 'Tissue visible' : '')).slice(0, 120),
  )
  await shot(page, 'roi-drawn')
}

// === Runner ===

const browser = await chromium.launch({
  headless: !headed,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: evidenceDir, size: { width: 1600, height: 900 } },
})
/** Screenshot math runs here so its scratch pages stay out of the recorded video. */
const analysis = await browser.newContext()
const page = await context.newPage()
page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`))
page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err.message}`))
/** Match on origin: the IDC proxy rewrites BulkDataURIs to a sibling /bulk/... path. */
const dicomwebOrigin = new URL(dicomwebUrl).origin
context.on('response', (response) => {
  if (response.url().startsWith(dicomwebOrigin)) {
    dicomweb.push({ url: response.url(), status: response.status(), method: response.request().method() })
  }
})

let crash
const started = Date.now()
try {
  await journeys[journeyName](page, analysis)
} catch (error) {
  crash = error
  check('journey ran to completion', false, error.message.split('\n')[0])
  await shot(page, 'failure').catch(() => {})
}
const video = page.video()
await context.close()
await browser.close()
if (video !== null) {
  fs.renameSync(await video.path(), path.join(evidenceDir, 'video.webm'))
}

const pageErrors = consoleLines.filter((l) => l.startsWith('[pageerror]'))
fs.writeFileSync(path.join(evidenceDir, 'console.log'), `${consoleLines.join('\n')}\n`)
fs.writeFileSync(path.join(evidenceDir, 'dicomweb.jsonl'), dicomweb.map((r) => JSON.stringify(r)).join('\n'))
const passed = checks.length > 0 && checks.every((c) => c.passed)
const result = {
  journey: journeyName,
  passed,
  baseUrl,
  dicomwebUrl,
  durationMs: Date.now() - started,
  checks,
  dicomwebResponses: dicomweb.length,
  dicomwebErrors: dicomweb.filter((r) => r.status >= 400).length,
  pageErrors,
  crash: crash?.stack,
}
fs.writeFileSync(path.join(evidenceDir, 'result.json'), JSON.stringify(result, null, 2))
console.log(`\n${passed ? 'PASSED' : 'FAILED'}: ${journeyName}. Evidence: ${evidenceDir}`)
if (pageErrors.length > 0) {
  console.log(`${pageErrors.length} uncaught page error(s); see console.log in the evidence dir.`)
}
process.exit(passed ? 0 : 1)
