#!/usr/bin/env node
/**
 * Seed the docker-compose dcm4chee archive with one SM series from the public
 * IDC proxy so D9 (Save ROIs → reload SR) can run against a writable server.
 *
 * Usage:
 *   node scripts/seed-local-archive.mjs
 *   SLIM_LOCAL_DICOMWEB_URL=… IDC_SERIES_UID=… node scripts/seed-local-archive.mjs
 *
 * Writes e2e/.local-archive-seed.json with the study/series UIDs for Playwright.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'e2e/.local-archive-seed.json')

const LOCAL =
  process.env.SLIM_LOCAL_DICOMWEB_URL ??
  'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs'
const IDC =
  process.env.IDC_DICOMWEB_URL ??
  'https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb'
/** CPTAC-LSCC C3L-00965 first slide — small enough for a CI seed when capped. */
const STUDY =
  process.env.IDC_STUDY_UID ?? '2.25.211094631316408413440371843585977094852'
const SERIES =
  process.env.IDC_SERIES_UID ??
  '1.3.6.1.4.1.5962.99.1.215230799.1236847520.1640892770639.2.0'
const MAX_INSTANCES = Number(process.env.SEED_MAX_INSTANCES ?? 12)
const MAX_BYTES = Number(process.env.SEED_MAX_BYTES ?? 40 * 1024 * 1024)

/** Node CLI output (avoid `console.*`, which DeepSource flags under browser env). */
function log(message) {
  process.stdout.write(`${message}\n`)
}

function warn(message) {
  process.stderr.write(`${message}\n`)
}

async function waitForArchive(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${LOCAL}/studies`, { method: 'GET' })
      if (response.status === 200 || response.status === 204) return
    } catch {
      /** Retry until WildFly is listening. */
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error('Local DICOMweb archive did not become ready')
}

async function listInstances() {
  const params = new URLSearchParams({
    includefield: '00080008',
  })
  params.append('includefield', '00280010')
  params.append('includefield', '00280011')
  const url = `${IDC}/studies/${STUDY}/series/${SERIES}/instances?${params}`
  const response = await fetch(url, {
    headers: { Accept: 'application/dicom+json' },
  })
  if (!response.ok) {
    throw new Error(`QIDO instances failed: ${response.status}`)
  }
  const rows = await response.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No instances for the configured series')
  }
  /**
   * VOLUME frames only, smallest first — a few pyramid tip levels fit under
   * SEED_MAX_BYTES and are enough for Slim to open a slide. Skipping the
   * full-resolution base avoids a multi-hundred-MB STOW.
   */
  return rows
    .map((row) => {
      const uid = row?.['00080018']?.Value?.[0]
      const rowsN = Number(row?.['00280010']?.Value?.[0] ?? 0)
      const colsN = Number(row?.['00280011']?.Value?.[0] ?? 0)
      const imageType = (row?.['00080008']?.Value ?? []).map(String)
      return {
        uid,
        pixels: rowsN * colsN,
        isVolume: imageType.includes('VOLUME'),
      }
    })
    .filter(
      (row) =>
        typeof row.uid === 'string' &&
        row.uid.length > 0 &&
        row.isVolume &&
        row.pixels > 0,
    )
    .sort((a, b) => a.pixels - b.pixels)
}

async function retrieveInstance(sopInstanceUID, attempts = 4) {
  const url = `${IDC}/studies/${STUDY}/series/${SERIES}/instances/${sopInstanceUID}`
  let lastError = new Error('WADO instance failed')
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, {
      headers: { Accept: 'application/dicom; transfer-syntax=*' },
    })
    if (response.ok) {
      return Buffer.from(await response.arrayBuffer())
    }
    lastError = new Error(`WADO instance failed: ${response.status}`)
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
  }
  throw lastError
}

/**
 * STOW-RS multipart/related with one application/dicom part (dcm4chee accepts
 * this simpler form for a single instance).
 */
async function stowInstance(buffer, sopInstanceUID) {
  const boundary = `slim-seed-${sopInstanceUID.slice(-12)}`
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`,
  )
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([preamble, buffer, epilogue])
  const response = await fetch(`${LOCAL}/studies`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; type="application/dicom"; boundary=${boundary}`,
      Accept: 'application/dicom+json',
    },
    body,
  })
  if (!response.ok) {
    throw new Error(`STOW failed (${response.status})`)
  }
}

async function main() {
  log('Waiting for local DICOMweb archive…')
  await waitForArchive()
  log('Listing VOLUME instances from IDC…')
  const instances = await listInstances()
  const selected = instances.slice(0, MAX_INSTANCES)
  log(
    `Seeding up to ${selected.length}/${instances.length} VOLUME instances (smallest first, cap ${MAX_BYTES} bytes)…`,
  )

  let total = 0
  const stored = []
  for (const { uid, pixels } of selected) {
    let buffer = null
    try {
      buffer = await retrieveInstance(uid)
    } catch {
      warn('  skip one instance (WADO retrieve failed)')
      continue
    }
    total += buffer.length
    if (total > MAX_BYTES) {
      warn('Stopping: would exceed SEED_MAX_BYTES.')
      break
    }
    log(`  STOW instance (${buffer.length} bytes, ~${pixels} px)`)
    await stowInstance(buffer, uid)
    stored.push(uid)
  }

  if (stored.length === 0) {
    throw new Error('No instances were stored')
  }

  const seed = {
    studyInstanceUID: STUDY,
    seriesInstanceUID: SERIES,
    instanceUIDs: stored,
    localDicomwebUrl: LOCAL,
    seededAt: new Date().toISOString(),
  }
  fs.writeFileSync(OUT, `${JSON.stringify(seed, null, 2)}\n`)
  log(`Wrote ${OUT}`)
  log(
    'Seed complete. Open the seeded study/series on the local Slim app (port 8008).',
  )
}

main().catch((error) => {
  warn(error instanceof Error ? error.message : 'seed failed')
  process.exit(1)
})
