#!/usr/bin/env node
/**
 * Writes public/config/env.js from process env + .env.
 * Configs read window.slim.env.VAR_NAME.
 * Only an allowlisted set of SLIM_* keys is exported (avoids leaking unrelated secrets).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.join(root, 'public/config/env.js')

const DEFAULT_LOCAL_DICOMWEB_URL =
  'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs'

const ALLOWED_SLIM_ENV_KEYS = [
  'SLIM_LOCAL_DICOMWEB_URL',
  'SLIM_DEMO_DICOMWEB_URL',
  'SLIM_PREVIEW_DICOMWEB_URL',
]

const requiredUrlByConfig = {
  local: 'SLIM_LOCAL_DICOMWEB_URL',
  demo: 'SLIM_DEMO_DICOMWEB_URL',
  preview: 'SLIM_PREVIEW_DICOMWEB_URL',
}

function loadDotEnvInto(file, target) {
  if (!fs.existsSync(file)) {
    return
  }
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1)
    }
    target[key] = val
  }
}

const fileValues = {}
loadDotEnvInto(path.join(root, '.env'), fileValues)

for (const [key, value] of Object.entries(fileValues)) {
  if (process.env[key] === undefined) {
    process.env[key] = value
  }
}

// Safe public default for docker-compose / fresh clones / CI unit builds.
if (!process.env.SLIM_LOCAL_DICOMWEB_URL) {
  process.env.SLIM_LOCAL_DICOMWEB_URL = DEFAULT_LOCAL_DICOMWEB_URL
}

const slimEnv = {}
for (const key of ALLOWED_SLIM_ENV_KEYS) {
  const value = process.env[key]
  if (value !== undefined && value !== '') {
    slimEnv[key] = value
  }
}

const configName = process.env.REACT_APP_CONFIG || 'local'
const requiredKey = requiredUrlByConfig[configName]
if (requiredKey && !slimEnv[requiredKey]) {
  const ciHint =
    requiredKey === 'SLIM_DEMO_DICOMWEB_URL' ||
    requiredKey === 'SLIM_PREVIEW_DICOMWEB_URL'
      ? ` Set GitHub Actions secret or variable ${requiredKey}, or add it to .env.`
      : ' Set it in .env (see .env.example).'
  console.error(
    `${requiredKey} is required when REACT_APP_CONFIG=${configName}.${ciHint}`
  )
  process.exit(1)
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(
  outPath,
  [
    'window.slim = window.slim || {}',
    `window.slim.env = ${JSON.stringify(slimEnv, null, 2)}`,
    '',
  ].join('\n')
)
