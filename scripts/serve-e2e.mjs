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
import { existsSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
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

/**
 * Resolve a request path under ROOT, rejecting anything that escapes it
 * (including encoded `..` segments and absolute paths).
 */
function safeJoin(root, urlPath) {
  const raw = (urlPath.split('?')[0] ?? '/').replace(/^\/+/, '')
  let decoded
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null
  }
  if (decoded.includes('\0')) {
    return null
  }
  const candidate = resolve(root, decoded)
  const rel = relative(root, candidate)
  if (rel.startsWith('..') || rel.includes(`..${'/'}`) || rel.includes('..\\')) {
    return null
  }
  return candidate
}

/**
 * Stream a regular file to the response. Returns true on success, false if the
 * path is missing, not a file, or cannot be opened. Uses open()+fstat so we
 * never call existsSync/statSync on a user-controlled path (Sonar S6549) and
 * so directories are rejected cleanly (createReadStream on a dir can hang).
 */
async function trySendFile(res, filePath) {
  let handle
  try {
    handle = await open(filePath, 'r')
    const stats = await handle.stat()
    if (!stats.isFile()) {
      await handle.close()
      handle = undefined
      return false
    }
    const type =
      MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
    })
    // Stream owns the fd (autoClose); clear our handle so we don't double-close.
    const stream = handle.createReadStream()
    handle = undefined
    stream.pipe(res)
    return true
  } catch {
    if (handle != null) {
      await handle.close().catch(() => undefined)
    }
    return false
  }
}

if (!existsSync(ROOT)) {
  process.stderr.write(`[serve-e2e] build directory not found: ${ROOT}\n`)
  process.stderr.write('Run `pnpm run build:e2e` first.\n')
  process.exit(1)
}

const SPA_INDEX = join(ROOT, 'index.html')

const server = createServer((req, res) => {
  void (async () => {
    const urlPath = req.url ?? '/'
    const filePath = safeJoin(ROOT, urlPath)
    if (filePath == null) {
      res.writeHead(400).end('Bad Request')
      return
    }

    if (await trySendFile(res, filePath)) {
      return
    }

    // SPA fallback for client-side routes like /studies/...
    if (await trySendFile(res, SPA_INDEX)) {
      return
    }

    res.writeHead(404).end('Not Found')
  })()
})

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `[serve-e2e] serving ${ROOT} at http://${HOST}:${PORT}\n`,
  )
})
