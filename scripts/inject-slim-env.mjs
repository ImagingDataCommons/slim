#!/usr/bin/env node
/**
 * Writes public/config/env.js from process env + .env.
 * Configs read window.slim.env.VAR_NAME.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveSlimEnv, slimEnvScript } from './slimEnv.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.join(root, 'public/config/env.js')

const { values, configName, missingKey } = resolveSlimEnv(root, process.env)
if (missingKey !== undefined) {
  const hint =
    missingKey === 'SLIM_LOCAL_DICOMWEB_URL'
      ? ' Set it in .env (see .env.example).'
      : ` Set GitHub Actions secret or variable ${missingKey}, or add it to .env.`
  process.stderr.write(
    `${missingKey} is required when REACT_APP_CONFIG=${configName}.${hint}\n`,
  )
  process.exit(1)
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, slimEnvScript(values))
