import data from '../data/idc-examples.json'
import { demoSeriesUrl } from '../data/site'

export interface IdcExample {
  id: string
  caption: string
  available: boolean
  collection?: string
  collectionName?: string
  modality?: string
  sopClassUID?: string
  sopClassName?: string
  license?: string
  sizeMB?: number
  sourceDOI?: string | null
  studyInstanceUID?: string
  seriesInstanceUID?: string
  seriesDescription?: string
  detail?: string
  stateSeriesInstanceUID?: string
  stateInstanceUID?: string
}

export const idcVersion: string = data.idcVersion
export const examplesGeneratedAt: string = data.generatedAt
export const examples: readonly IdcExample[] = data.examples

export function getExample(id: string | undefined): IdcExample | undefined {
  if (id === undefined) return undefined
  return examples.find((example) => example.id === id)
}

/**
 * Demo viewer link for an example. Derived objects link to their own series:
 * Slim loads the slide they reference and turns the object on.
 */
export function exampleUrl(example: IdcExample): string | undefined {
  if (
    !example.available ||
    !example.studyInstanceUID ||
    !example.seriesInstanceUID
  ) {
    return undefined
  }
  return demoSeriesUrl(
    example.studyInstanceUID,
    example.seriesInstanceUID,
    example.stateInstanceUID,
  )
}

export function collectionUrl(collection: string | undefined): string {
  return `https://portal.imaging.datacommons.cancer.gov/explore/filters/?collection_id=${collection ?? ''}`
}
