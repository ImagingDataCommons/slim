import { type CollectionEntry, getCollection } from 'astro:content'
import { compareVersionsDesc } from './changelog'

export async function getChangelog(): Promise<CollectionEntry<'changelog'>[]> {
  return (await getCollection('changelog')).sort((a, b) =>
    compareVersionsDesc(a.data.version, b.data.version),
  )
}

export async function getHighlights(): Promise<CollectionEntry<'releases'>[]> {
  return (await getCollection('releases')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  )
}

export async function getFeatures(): Promise<CollectionEntry<'features'>[]> {
  return (await getCollection('features')).sort(
    (a, b) => a.data.order - b.data.order,
  )
}

export async function getShowcase(): Promise<CollectionEntry<'showcase'>[]> {
  return (await getCollection('showcase')).sort(
    (a, b) => a.data.order - b.data.order,
  )
}

/** Anchor on the features page, e.g. `02-annotations` becomes `annotations` */
export function featureAnchor(feature: CollectionEntry<'features'>): string {
  return feature.id.replace(/^\d+-/, '')
}
