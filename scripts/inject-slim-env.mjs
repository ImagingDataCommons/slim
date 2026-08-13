#!/usr/bin/env node
/**
 * Writes public/config/env.js from process env + .env / .env.local.
 * Optional: configs may hardcode values, or read window.slim.env.VAR_NAME.
 * Only SLIM_* keys are exported onto window.slim.env.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.join(root, 'public/config/env.js')

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

// Match CRA local file order: .env then .env.local. Existing process.env wins.
const fileValues = {}
loadDotEnvInto(path.join(root, '.env'), fileValues)
loadDotEnvInto(path.join(root, '.env.local'), fileValues)

for (const [key, value] of Object.entries(fileValues)) {
  if (process.env[key] === undefined) {
    process.env[key] = value
  }
}

const slimEnv = {}
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('SLIM_') && value !== undefined && value !== '') {
    slimEnv[key] = value
  }
}

const configName = process.env.REACT_APP_CONFIG || 'local'
if (configName === 'preview' && !slimEnv.SLIM_PREVIEW_DICOMWEB_URL) {
  console.error(
    'SLIM_PREVIEW_DICOMWEB_URL is required when REACT_APP_CONFIG=preview (set in .env.local or CI).'
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
