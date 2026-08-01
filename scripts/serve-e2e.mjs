#!/usr/bin/env node
/**
 * Tiny SPA static file server for e2e / visual-regression runs.
 *
 * Serves the CRA `build/` directory on 127.0.0.1:3977 and falls back to
 * index.html for unknown paths (required for deep links like /studies/...).
 *
 * Kept dependency-free on purpose: the `serve` package currently crashes
 * under path-to-regexp v8 (`pathToRegExp.compile is not a function`), and
 * pulling in another static-server package just to host a directory is not
 * worth the risk of similar peer-dep breakage.
 */
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOST = process.env.E2E_HOST ?? '127.0.0.1'
const PORT = Number(process.env.E2E_PORT ?? 3977)
const ROOT = resolve(
  process.env.E2E_BUILD_DIR ??
    join(fileURLToPath(new URL('.', import.meta.url)), '..', 'build'),
)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const candidate = normalize(join(root, decoded))
  if (!candidate.startsWith(root)) {
    return null
  }
  return candidate
}

function sendFile(res, filePath) {
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  })
  createReadStream(filePath).pipe(res)
}

if (!existsSync(ROOT)) {
  console.error(`[serve-e2e] build directory not found: ${ROOT}`)
  console.error('Run `pnpm run build:e2e` first.')
  process.exit(1)
}

const server = createServer((req, res) => {
  const urlPath = req.url ?? '/'
  const filePath = safeJoin(ROOT, urlPath)
  if (filePath == null) {
    res.writeHead(400).end('Bad Request')
    return
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(res, filePath)
    return
  }

  // Directory index or SPA fallback.
  const indexInDir = join(filePath, 'index.html')
  if (existsSync(indexInDir) && statSync(indexInDir).isFile()) {
    sendFile(res, indexInDir)
    return
  }

  const spa = join(ROOT, 'index.html')
  if (existsSync(spa)) {
    sendFile(res, spa)
    return
  }

  res.writeHead(404).end('Not Found')
})

server.listen(PORT, HOST, () => {
  console.log(`[serve-e2e] serving ${ROOT} at http://${HOST}:${PORT}`)
})
