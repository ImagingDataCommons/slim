#!/usr/bin/env node
/**
 * Captures the screenshots the website shows, from a running Slim app that
 * loads data from the IDC public proxy:
 *
 *   REACT_APP_CONFIG=preview SLIM_PREVIEW_DICOMWEB_URL=<IDC proxy> pnpm start --port 3100
 *   SLIM_APP_URL=http://localhost:3100 pnpm --filter slim-website capture-screenshots
 *
 * Writes public/screenshots/{name}-{dark,light}.webp (1440x900),
 * public/examples/{id}.webp thumbnails, and public/og.png (1200x630).
 *
 * Flags: --only=viewer,worklist  --skip-examples  --skip-og
 * Env: SLIM_APP_URL, PLAYWRIGHT_CHANNEL (default "chrome"; "" for bundled Chromium)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const root = new URL('..', import.meta.url)
const appUrl = (process.env.SLIM_APP_URL ?? 'http://localhost:3100').replace(
  /\/+$/,
  '',
)
const channel = process.env.PLAYWRIGHT_CHANNEL ?? 'chrome'

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=')
    return [key, value]
  }),
)
const only = args.get('only')?.split(',')

const VIEWPORT = { width: 1440, height: 900 }
const THEMES = ['dark', 'light']
const LOAD_TIMEOUT = 120_000

const { examples } = JSON.parse(
  await readFile(new URL('src/data/idc-examples.json', root), 'utf8'),
)
const byId = new Map(
  examples.filter((example) => example.available).map((e) => [e.id, e]),
)

function viewerPath(id) {
  const example = byId.get(id)
  if (!example)
    throw new Error(`No available example "${id}" in idc-examples.json`)
  const path = `/studies/${example.studyInstanceUID}/series/${example.seriesInstanceUID}`
  return example.stateInstanceUID
    ? `${path}?state=${example.stateInstanceUID}`
    : path
}

/**
 * Waits until no loading indicator is visible, then gives tiles a moment to
 * settle. The indicators fade out but stay in the DOM, so only visible ones count.
 */
async function waitForApp(page) {
  await page.waitForFunction(
    () => {
      const loading = /Loading (studies|study|slide)/
      const visibleIndicator = [...document.querySelectorAll('body *')].some(
        (element) =>
          [...element.childNodes].some(
            (node) =>
              node.nodeType === Node.TEXT_NODE &&
              loading.test(node.textContent ?? ''),
          ) &&
          element.checkVisibility({
            opacityProperty: true,
            visibilityProperty: true,
          }),
      )
      return document.body.innerText.length > 0 && !visibleIndicator
    },
    undefined,
    { timeout: LOAD_TIMEOUT, polling: 500 },
  )
  await page
    .waitForLoadState('networkidle', { timeout: 20_000 })
    .catch(() => {})
  await page.waitForTimeout(2500)
}

async function openDialog(page, buttonName, menuItem) {
  await page.getByRole('button', { name: buttonName }).first().click()
  if (menuItem)
    await page.getByRole('menuitem', { name: menuItem }).first().click()
  await page.getByRole('dialog').first().waitFor({ timeout: 15_000 })
  await page.waitForTimeout(600)
}

const SHOTS = [
  { name: 'worklist', path: '/?contains=ann' },
  { name: 'viewer', path: viewerPath('brightfield'), example: 'brightfield' },
  { name: 'annotations', path: viewerPath('ann'), example: 'ann' },
  {
    name: 'segmentation',
    path: viewerPath('seg-fractional'),
    example: 'seg-fractional',
  },
  {
    name: 'fluorescence',
    path: viewerPath('fluorescence'),
    example: 'fluorescence',
  },
  { name: 'draw', path: viewerPath('sr'), example: 'sr' },
  {
    name: 'server',
    path: '/',
    action: (page) => openDialog(page, 'Select server'),
  },
  {
    name: 'preferences',
    path: '/',
    action: (page) => openDialog(page, /Guest|Not signed in/, 'Preferences'),
  },
]

/** Encodes a PNG as WebP (optionally resized) with the browser's canvas encoder */
async function toWebp(encoder, png, { width, height, quality = 0.84 } = {}) {
  const dataUrl = await encoder.evaluate(
    async ({ src, width, height, quality }) => {
      const image = new Image()
      image.src = src
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = width ?? image.naturalWidth
      canvas.height = height ?? image.naturalHeight
      const context = canvas.getContext('2d')
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/webp', quality)
    },
    {
      src: `data:image/png;base64,${png.toString('base64')}`,
      width,
      height,
      quality,
    },
  )
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

/** The largest OpenLayers viewport on the page is the slide; the others are the overview */
async function slideClip(page) {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.ol-viewport')]
      .map((element) => element.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0)
      .sort((a, b) => b.width * b.height - a.width * a.height)
    const box = boxes[0]
    if (!box) return undefined
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  })
}

/** Crops the slide viewport to 16:10 around its centre */
function centredClip(clip) {
  const ratio = 16 / 10
  let { width, height } = clip
  if (width / height > ratio) width = height * ratio
  else height = width / ratio
  return {
    x: Math.round(clip.x + (clip.width - width) / 2),
    y: Math.round(clip.y + (clip.height - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  }
}

async function newThemedPage(browser, theme) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: theme,
    reducedMotion: 'reduce',
  })
  await context.addInitScript((value) => {
    window.localStorage.setItem('slim-theme', value)
  }, theme)
  return context.newPage()
}

async function capture() {
  /** Headless Chrome only offers WebGL, which the slide renderer needs, through SwiftShader */
  const browser = await chromium.launch({
    ...(channel ? { channel } : {}),
    args: [
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
    ],
  })
  const encoder = await (await browser.newContext()).newPage()
  const screenshotsDir = new URL('public/screenshots/', root)
  const examplesDir = new URL('public/examples/', root)
  await mkdir(screenshotsDir, { recursive: true })
  await mkdir(examplesDir, { recursive: true })

  const thumbnails = new Set()
  const saveThumbnail = async (page, id) => {
    const clip = await slideClip(page)
    if (!clip) return
    const png = await page.screenshot({ clip: centredClip(clip) })
    await writeFile(
      new URL(`${id}.webp`, examplesDir),
      await toWebp(encoder, png, { width: 640, height: 400 }),
    )
    thumbnails.add(id)
    console.log(`  examples/${id}.webp`)
  }

  const shots = only ? SHOTS.filter((shot) => only.includes(shot.name)) : SHOTS
  for (const shot of shots) {
    for (const theme of THEMES) {
      const page = await newThemedPage(browser, theme)
      try {
        await page.goto(`${appUrl}${shot.path}`, {
          waitUntil: 'domcontentloaded',
        })
        await waitForApp(page)
        if (shot.action) await shot.action(page)
        const png = await page.screenshot()
        await writeFile(
          new URL(`${shot.name}-${theme}.webp`, screenshotsDir),
          await toWebp(encoder, png),
        )
        console.log(`  screenshots/${shot.name}-${theme}.webp`)
        if (theme === 'dark' && shot.example && !args.has('skip-examples')) {
          await saveThumbnail(page, shot.example)
        }
      } catch (error) {
        console.error(`  ✗ ${shot.name} (${theme}): ${error.message}`)
        process.exitCode = 1
      } finally {
        await page.context().close()
      }
    }
  }

  if (!args.has('skip-examples') && !only) {
    for (const id of byId.keys()) {
      if (thumbnails.has(id)) continue
      const page = await newThemedPage(browser, 'dark')
      try {
        await page.goto(`${appUrl}${viewerPath(id)}`, {
          waitUntil: 'domcontentloaded',
        })
        await waitForApp(page)
        await saveThumbnail(page, id)
      } catch (error) {
        console.error(`  ✗ examples/${id}: ${error.message}`)
        process.exitCode = 1
      } finally {
        await page.context().close()
      }
    }
  }

  if (!args.has('skip-og')) await renderOgImage(browser)
  await browser.close()
}

/** Social card: brand tokens from the shared stylesheet, plus the dark viewer screenshot */
async function renderOgImage(browser) {
  const tokens = await readFile(
    new URL('../src/styles/tokens.css', root),
    'utf8',
  )
  const darkBlock = tokens.slice(tokens.indexOf('.dark {'))
  const darkVars = darkBlock
    .slice(0, darkBlock.indexOf('}'))
    .replace('.dark {', '')
  const font = (weight) =>
    readFile(
      require.resolve(
        `@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-${weight}-normal.woff2`,
      ),
    ).then((buffer) => buffer.toString('base64'))
  const [regular, semibold, logo, viewer] = await Promise.all([
    font(400),
    font(600),
    readFile(new URL('public/favicon.svg', root)).then((buffer) =>
      buffer.toString('base64'),
    ),
    readFile(new URL('public/screenshots/viewer-dark.webp', root)).then(
      (buffer) => buffer.toString('base64'),
    ),
  ])

  const html = `<!doctype html><html><head><style>
    @font-face { font-family: Plex; font-weight: 400; src: url(data:font/woff2;base64,${regular}) format('woff2'); }
    @font-face { font-family: Plex; font-weight: 600; src: url(data:font/woff2;base64,${semibold}) format('woff2'); }
    :root { ${darkVars} }
    * { box-sizing: border-box; margin: 0; }
    body { width: 1200px; height: 630px; overflow: hidden; font-family: Plex, sans-serif;
      background: rgb(var(--app)); color: rgb(var(--ink)); position: relative; }
    .glow { position: absolute; inset: 0;
      background: radial-gradient(ellipse at 15% 0%, rgb(var(--primary) / 0.22), transparent 60%); }
    .copy { position: absolute; left: 72px; top: 72px; width: 520px; }
    .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 600; }
    .brand img { width: 52px; height: 52px; }
    h1 { margin-top: 56px; font-size: 54px; line-height: 1.08; font-weight: 600; letter-spacing: -0.02em; }
    p { margin-top: 24px; font-size: 22px; line-height: 1.45; color: rgb(var(--ink-secondary)); }
    .shot { position: absolute; left: 640px; top: 96px; width: 760px; border-radius: 14px; overflow: hidden;
      border: 1px solid rgb(var(--line)); box-shadow: 0 30px 80px rgb(var(--shadow-color) / 0.5); }
    .shot img { display: block; width: 100%; }
  </style></head><body>
    <div class="glow"></div>
    <div class="copy">
      <div class="brand"><img src="data:image/svg+xml;base64,${logo}" alt="">Slim</div>
      <h1>The web viewer for DICOM slide microscopy</h1>
      <p>Open source, zero footprint, DICOMweb native.</p>
    </div>
    <div class="shot"><img src="data:image/webp;base64,${viewer}" alt=""></div>
  </body></html>`

  const page = await (
    await browser.newContext({ viewport: { width: 1200, height: 630 } })
  ).newPage()
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await writeFile(
    new URL('public/og.png', root),
    await page.screenshot({ type: 'png' }),
  )
  console.log('  og.png')
  await page.context().close()
}

await capture()
