import { logger } from '../../../utils/logger'
import { withItems } from './uidSets'

export interface ShowMatchingSeriesItemsOptions<T> {
  items: readonly T[]
  seriesInstanceUID: string
  /** Short label for debug logs, e.g. "Segmentation" */
  label: string
  getSeriesInstanceUID: (item: T) => string | undefined
  getId: (item: T) => string
  show: (id: string) => void
  setVisible: (update: (current: Set<string>) => Set<string>) => void
  /** Return true to skip an item without counting it as a show failure */
  shouldSkip?: (item: T) => boolean
}

/**
 * Show every item of `seriesInstanceUID` that is already loaded in the
 * viewer. One failure must not keep the others hidden.
 */
export function showMatchingSeriesItems<T>({
  items,
  seriesInstanceUID,
  label,
  getSeriesInstanceUID,
  getId,
  show,
  setVisible,
  shouldSkip,
}: ShowMatchingSeriesItemsOptions<T>): void {
  const matching = items.filter(
    (item) => getSeriesInstanceUID(item) === seriesInstanceUID,
  )
  logger.debug(
    `auto-load ${label}: found ${matching.length} matching item(s) ` +
      `out of ${items.length} total for series "${seriesInstanceUID}"`,
  )
  const shown: string[] = []
  for (const item of matching) {
    const id = getId(item)
    if (shouldSkip?.(item) === true) {
      logger.debug(`auto-load ${label}: skipping "${id}"`)
      continue
    }
    try {
      show(id)
      shown.push(id)
    } catch (error) {
      logger.error(`failed to auto-show ${label} "${id}":`, error)
    }
  }
  logger.debug(
    `auto-load ${label}: showing ${shown.length}/${matching.length} item(s)`,
  )
  if (shown.length > 0) {
    setVisible((current) => withItems(current, shown))
  }
  logger.debug(`Loading ${label}`)
}
