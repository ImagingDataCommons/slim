import { formatStudyDateTime } from '../../utils/displayFormat'

function toSortableNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const numeric = Number(value)
  return Number.isNaN(numeric) ? undefined : numeric
}

/** Ascending numeric order; missing or non-numeric values sort last */
function compareOptionalNumbers(a: unknown, b: unknown): number {
  const left = toSortableNumber(a)
  const right = toSortableNumber(b)
  if (left === undefined && right === undefined) return 0
  if (left === undefined) return 1
  if (right === undefined) return -1
  return left - right
}

export function sortInstancesByNumber<T extends object>(
  images: readonly T[],
): T[] {
  return [...images].sort((a, b) =>
    compareOptionalNumbers(
      Reflect.get(a, 'InstanceNumber'),
      Reflect.get(b, 'InstanceNumber'),
    ),
  )
}

/** Total pixel matrix size for WSI instances, else Rows/Columns */
export function getInstanceDimensions(
  metadata: Record<string, unknown> | undefined,
): { columns?: number; rows?: number } | undefined {
  if (metadata === undefined || metadata === null) return undefined
  const columns = Number(
    metadata.TotalPixelMatrixColumns ?? metadata.Columns ?? Number.NaN,
  )
  const rows = Number(
    metadata.TotalPixelMatrixRows ?? metadata.Rows ?? Number.NaN,
  )
  return {
    columns: Number.isFinite(columns) ? columns : undefined,
    rows: Number.isFinite(rows) ? rows : undefined,
  }
}

export interface SeriesLike {
  SeriesNumber?: string
  SeriesDate?: string
  SeriesTime?: string
  SeriesDescription?: string
  Modality?: string
}

export function sortSeriesByNumber<T extends SeriesLike>(
  series: readonly T[],
): T[] {
  return [...series].sort((a, b) =>
    compareOptionalNumbers(a.SeriesNumber, b.SeriesNumber),
  )
}

/** "3 (SM): Slide 1" and the series date/time, e.g. "15 Jan 2024, 10:15" */
export function getSeriesLabel(series: SeriesLike): {
  label: string
  description: string
} {
  const { SeriesNumber = '', SeriesDescription = '', Modality = '' } = series
  return {
    label: `${SeriesNumber} (${Modality}): ${SeriesDescription}`,
    description: formatStudyDateTime(series.SeriesDate, series.SeriesTime),
  }
}

/** Own enumerable fields of a dataset object, for the tag table */
export function toTagRecord(dataset: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dataset))
}

function readText(source: object, key: string): string | undefined {
  const value: unknown = Reflect.get(source, key)
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

/** One selectable series of the tag browser and its instances */
export interface DisplaySet extends SeriesLike {
  SeriesInstanceUID: string
  images: readonly object[]
}

export interface SlideImagesLike {
  volumeImages?: readonly object[]
  overviewImages?: readonly object[]
  labelImages?: readonly object[]
}

export interface StudySeriesLike {
  SeriesInstanceUID: string
  SeriesNumber?: number | string
  SeriesDate?: string
  SeriesTime?: string
  SeriesDescription?: string
  Modality?: string
  instances?: readonly object[]
}

/**
 * One display set per SeriesInstanceUID, sorted by series number. Slide
 * images come first (volume, overview and label images often share a series;
 * duplicate SOP instances are dropped); study series without slide images
 * are added after, using the series itself when it has no instances.
 */
export function buildDisplaySets(
  slides: readonly SlideImagesLike[],
  studySeries: readonly StudySeriesLike[] = [],
): DisplaySet[] {
  const imagesBySeries = new Map<
    string,
    { images: object[]; sopInstanceUIDs: Set<string> }
  >()
  for (const slide of slides) {
    for (const images of [
      slide.volumeImages,
      slide.overviewImages,
      slide.labelImages,
    ]) {
      for (const image of images ?? []) {
        const seriesUID = readText(image, 'SeriesInstanceUID') ?? ''
        if (seriesUID === '') continue
        let entry = imagesBySeries.get(seriesUID)
        if (entry === undefined) {
          entry = { images: [], sopInstanceUIDs: new Set() }
          imagesBySeries.set(seriesUID, entry)
        }
        const sopUID = readText(image, 'SOPInstanceUID') ?? ''
        if (sopUID !== '') {
          if (entry.sopInstanceUIDs.has(sopUID)) continue
          entry.sopInstanceUIDs.add(sopUID)
        }
        entry.images.push(image)
      }
    }
  }

  const displaySets: DisplaySet[] = []
  for (const [seriesUID, { images }] of imagesBySeries) {
    const first = images[0]
    displaySets.push({
      SeriesInstanceUID: seriesUID,
      SeriesNumber: readText(first, 'SeriesNumber'),
      SeriesDate: readText(first, 'SeriesDate'),
      SeriesTime: readText(first, 'SeriesTime'),
      SeriesDescription: readText(first, 'SeriesDescription'),
      Modality: readText(first, 'Modality'),
      images,
    })
  }
  for (const series of studySeries) {
    const seriesUID = series.SeriesInstanceUID
    if (seriesUID === '' || imagesBySeries.has(seriesUID)) continue
    displaySets.push({
      SeriesInstanceUID: seriesUID,
      SeriesNumber:
        series.SeriesNumber !== undefined
          ? String(series.SeriesNumber)
          : undefined,
      SeriesDate: series.SeriesDate,
      SeriesTime: series.SeriesTime,
      SeriesDescription: series.SeriesDescription,
      Modality: series.Modality,
      images:
        series.instances !== undefined && series.instances.length > 0
          ? series.instances
          : [series],
    })
  }
  return sortSeriesByNumber(displaySets)
}

/** Copy of `set` with `value` added, or removed if present */
export function toggleSetValue<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}
