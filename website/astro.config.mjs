import { fileURLToPath } from 'node:url'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

const slimSrc = fileURLToPath(new URL('../src', import.meta.url))

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://slim-viewer.web.app',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  integrations: [react(), mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@slim': slimSrc,
      },
    },
    server: {
      fs: {
        /** Shared tokens and UI primitives live in the app's src/ */
        allow: ['..'],
      },
    },
  },
})
