import { defineCollection } from 'astro:content'
import { readFile } from 'node:fs/promises'
import { glob, type Loader } from 'astro/loaders'
import { z } from 'astro/zod'

import { parseChangelog, promoteSectionHeadings } from './lib/changelog'

const changelogPath = new URL('../../docs/CHANGELOG.md', import.meta.url)

/** One entry per version of docs/CHANGELOG.md, rendered at build time */
function changelogLoader(): Loader {
  return {
    name: 'slim-changelog',
    async load({
      store,
      parseData,
      renderMarkdown,
      generateDigest,
      watcher,
      logger,
    }) {
      const sync = async (): Promise<void> => {
        const markdown = await readFile(changelogPath, 'utf8')
        const entries = parseChangelog(markdown)
        store.clear()
        for (const entry of entries) {
          const data = await parseData({
            id: entry.version,
            data: {
              version: entry.version,
              date: entry.date,
              compareUrl: entry.compareUrl,
              isMinor: entry.isMinor,
              featureCount: entry.featureCount,
              fixCount: entry.fixCount,
            },
          })
          store.set({
            id: entry.version,
            data,
            body: entry.body,
            rendered: await renderMarkdown(promoteSectionHeadings(entry.body)),
            digest: generateDigest(entry.body),
          })
        }
        logger.info(`Loaded ${entries.length} changelog entries`)
      }

      await sync()
      watcher?.add(changelogPath.pathname)
      watcher?.on('change', (path) => {
        if (path === changelogPath.pathname) void sync()
      })
    },
  }
}

const changelog = defineCollection({
  loader: changelogLoader(),
  schema: z.object({
    version: z.string(),
    date: z.coerce.date(),
    compareUrl: z.url().nullable(),
    isMinor: z.boolean(),
    featureCount: z.number().int(),
    fixCount: z.number().int(),
  }),
})

/** Hand-written release highlights, e.g. the v2 redesign */
const releases = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/releases' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** Released version, or omitted while the release is pending */
    version: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
  }),
})

const showcase = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/showcase' }),
  schema: z.object({
    title: z.string(),
    organization: z.string(),
    summary: z.string(),
    order: z.number(),
    url: z.url(),
    tags: z.array(z.string()).default([]),
    stats: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .default([]),
    /** Ids from src/data/idc-examples.json to show as live examples */
    examples: z.array(z.string()).default([]),
    links: z.array(z.object({ label: z.string(), href: z.url() })).default([]),
  }),
})

const features = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/features' }),
  schema: z.object({
    title: z.string(),
    eyebrow: z.string(),
    summary: z.string(),
    order: z.number(),
    /** lucide-react icon name */
    icon: z.string(),
    bullets: z.array(z.string()).default([]),
    /** Screenshot key under public/screenshots/{key}-{dark,light}.webp */
    screenshot: z.string().optional(),
    /** Id from src/data/idc-examples.json for an "Open in Slim" link */
    example: z.string().optional(),
  }),
})

export const collections = { changelog, releases, showcase, features }
