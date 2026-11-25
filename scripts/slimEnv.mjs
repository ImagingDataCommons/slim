/**
 * Builds the `window.slim.env` script that public/config/*.js read their
 * DICOMweb URLs from. Shared by inject-slim-env.mjs (writes public/config/env.js
 * for builds) and the Vite dev server (serves it per process, so servers started
 * with different configs do not overwrite each other's URLs).
 */
import fs from 'node:fs'
import path from 'node:path'

export const DEFAULT_LOCAL_DICOMWEB_URL =
  'http://localhost:8008/dcm4chee-arc/aets/DCM4CHEE/rs'

/** Only these keys are exported, so unrelated secrets never reach the page */
const ALLOWED_SLIM_ENV_KEYS = [
  'SLIM_LOCAL_DICOMWEB_URL',
  'SLIM_DEMO_DICOMWEB_URL',
  'SLIM_PREVIEW_DICOMWEB_URL',
]

const REQUIRED_URL_BY_CONFIG = new Map([
  ['local', 'SLIM_LOCAL_DICOMWEB_URL'],
  ['demo', 'SLIM_DEMO_DICOMWEB_URL'],
  ['preview', 'SLIM_PREVIEW_DICOMWEB_URL'],
])

/**
 * @param {string} file
 * @returns {Record<string, string>}
 */
function readDotEnv(file) {
  /** @type {Record<string, string>} */
  const values = {}
  if (!fs.existsSync(file)) {
    return values
  }
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    const eq = trimmed.indexOf('=')
    if (trimmed === '' || trimmed.startsWith('#') || eq === -1) {
      continue
    }
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1)
    }
    values[trimmed.slice(0, eq).trim()] = value
  }
  return values
}

/**
 * Process env wins over `.env`; the local URL falls back to docker-compose.
 *
 * @param {string} root - repository root holding `.env`
 * @param {Record<string, string | undefined>} env - usually `process.env`
 * @returns {{ values: Record<string, string>, configName: string, missingKey: string | undefined }}
 */
export function resolveSlimEnv(root, env) {
  const merged = { ...readDotEnv(path.join(root, '.env')), ...env }
  if (!merged.SLIM_LOCAL_DICOMWEB_URL) {
    merged.SLIM_LOCAL_DICOMWEB_URL = DEFAULT_LOCAL_DICOMWEB_URL
  }
  /** @type {Record<string, string>} */
  const values = {}
  for (const key of ALLOWED_SLIM_ENV_KEYS) {
    const value = merged[key]
    if (value !== undefined && value !== '') {
      values[key] = value
    }
  }
  const configName = merged.REACT_APP_CONFIG || 'local'
  const requiredKey = REQUIRED_URL_BY_CONFIG.get(configName)
  const missingKey =
    requiredKey !== undefined && values[requiredKey] === undefined
      ? requiredKey
      : undefined
  return { values, configName, missingKey }
}

/**
 * @param {Record<string, string>} values
 * @returns {string}
 */
export function slimEnvScript(values) {
  return [
    'window.slim = window.slim || {}',
    `window.slim.env = ${JSON.stringify(values, null, 2)}`,
    '',
  ].join('\n')
}
