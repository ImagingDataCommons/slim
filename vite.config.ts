import fs from 'node:fs'
import path from 'node:path'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { loadEnv, normalizePath, type Plugin } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { configDefaults, defineConfig } from 'vitest/config'

import { resolveSlimEnv, slimEnvScript } from './scripts/slimEnv.mjs'

const root = import.meta.dirname
const dmvRoot = fs.realpathSync(
  path.join(root, 'node_modules/dicom-microscopy-viewer'),
)
const dmvDist = normalizePath(path.join(dmvRoot, 'dist/dynamic-import'))
const dmvBundle = `${dmvDist}/dicomMicroscopyViewer.min.js`
/** `pnpm link` points node_modules at a checkout outside the pnpm store */
const isDmvLinked = !dmvRoot.includes(`${path.sep}.pnpm${path.sep}`)

/** CRA-style PUBLIC_URL (`/`, `/slim` or a full URL) as a Vite `base` */
function toBase(publicUrl: string | undefined): string {
  if (publicUrl == null || publicUrl === '') {
    return '/'
  }
  return publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`
}

/**
 * Fills the CRA placeholders in index.html: `%PUBLIC_URL%` (base without the
 * trailing slash) and `%REACT_APP_CONFIG%` (the public/config/<name>.js file).
 */
function htmlPlaceholders(configName: string): Plugin {
  let publicUrl = ''
  return {
    name: 'slim:html-placeholders',
    configResolved(config) {
      publicUrl = config.base.replace(/\/$/, '')
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html
          .replaceAll('%PUBLIC_URL%', publicUrl)
          .replaceAll('%REACT_APP_CONFIG%', configName),
    },
  }
}

/**
 * Serves config/env.js from this dev server's own environment instead of the
 * shared file on disk, which the next `pnpm start` or build rewrites for its
 * own config.
 */
function serveSlimEnv(): Plugin {
  return {
    name: 'slim:serve-env',
    apply: 'serve',
    configureServer(server) {
      const script = slimEnvScript(resolveSlimEnv(root, process.env).values)
      const envPath = `${server.config.base}config/env.js`
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== envPath) {
          next()
          return
        }
        response.setHeader('Content-Type', 'text/javascript')
        response.setHeader('Cache-Control', 'no-store')
        response.end(script)
      })
    },
  }
}

/**
 * Linked DMV checkouts are pre-bundled once per server start, so re-run the
 * optimizer whenever DMV's watch build emits a new bundle.
 */
function reoptimizeLinkedDmv(): Plugin {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    name: 'slim:reoptimize-linked-dmv',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(dmvBundle)
      server.watcher.on('change', (file) => {
        if (normalizePath(file) !== dmvBundle) {
          return
        }
        clearTimeout(timer)
        timer = setTimeout(() => {
          void server.restart(true)
        }, 300)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '')
  const isTest = mode === 'test'
  const configName = env.REACT_APP_CONFIG || 'local'

  return {
    base: toBase(env.PUBLIC_URL),
    envPrefix: ['VITE_', 'REACT_APP_'],
    define: {
      'import.meta.env.REACT_APP_CONFIG': JSON.stringify(configName),
    },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      htmlPlaceholders(configName),
      serveSlimEnv(),
      /**
       * DMV resolves its web worker and codec .wasm files at runtime from
       * `window.config.path` + `static/js/` (see getMicroscopyHref in DMV).
       */
      viteStaticCopy({
        targets: [
          {
            src: [`${dmvDist}/*`, `!${dmvDist}/dicomMicroscopyViewer.min.js*`],
            dest: 'static/js',
            rename: { stripBase: true },
          },
        ],
      }),
      isDmvLinked && reoptimizeLinkedDmv(),
    ],
    resolve: {
      alias: [
        {
          find: /^dicom-microscopy-viewer$/,
          replacement: isTest
            ? path.join(root, 'src/__mocks__/dicomMicroscopyViewerMock.ts')
            : 'dicom-microscopy-viewer/dynamic-import',
        },
      ],
    },
    /**
     * The DMV build is a webpack UMD bundle, so it is pre-bundled even when
     * linked. A linked checkout is re-bundled on every start.
     */
    optimizeDeps: {
      include: ['dicom-microscopy-viewer/dynamic-import'],
      force: isDmvLinked,
    },
    server: {
      port: 3000,
      fs: { allow: [root, dmvRoot] },
    },
    build: {
      outDir: 'build',
      sourcemap: true,
      /** The DMV bundle alone is ~9 MB */
      chunkSizeWarningLimit: 12000,
      rolldownOptions: {
        /**
         * Builds emit no CSS sourcemaps, so Tailwind's map-less CSS transform
         * is expected.
         */
        onLog(level, log, handler) {
          if (
            log.code === 'SOURCEMAP_BROKEN' &&
            log.plugin?.startsWith('@tailwindcss/vite') === true
          ) {
            return
          }
          handler(level, log)
        },
      },
    },
    test: {
      environment: 'jsdom',
      /** Jest's jsdom origin; tests assert redirect URIs against it */
      environmentOptions: { jsdom: { url: 'http://localhost/' } },
      globals: true,
      setupFiles: ['src/setupTests.tsx'],
      /** The website package runs its own tests with node:test */
      exclude: [...configDefaults.exclude, 'website/**'],
      /** Matches the CRA Jest preset, which reset mocks before each test */
      mockReset: true,
    },
  }
})
