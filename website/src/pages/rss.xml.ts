import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { site } from '../data/site'
import { summarizeEntry } from '../lib/changelog'
import { getChangelog, getHighlights } from '../lib/content'

/** Release highlights and every changelog version, newest first */
export async function GET(context: APIContext): Promise<Response> {
  const highlights = await getHighlights()
  const changelog = await getChangelog()

  const items = [
    ...highlights.map((entry) => ({
      title: entry.data.title,
      description: entry.data.summary,
      pubDate: entry.data.date,
      link: `/release-notes/${entry.id}/`,
      categories: entry.data.tags,
    })),
    ...changelog.map((entry) => ({
      title: `Slim v${entry.data.version}`,
      description:
        summarizeEntry({ body: entry.body ?? '' }) || 'Maintenance release',
      pubDate: entry.data.date,
      link: `/release-notes/${entry.id}/`,
      content: entry.rendered?.html,
    })),
  ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf())

  return rss({
    title: 'Slim release notes',
    description: site.description,
    site: context.site ?? 'https://slim-website.web.app',
    items,
    customData: '<language>en</language>',
  })
}
