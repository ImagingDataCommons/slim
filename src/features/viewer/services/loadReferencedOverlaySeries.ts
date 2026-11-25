/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'

import type DicomWebManager from '../../../DicomWebManager'
import { logger } from '../../../utils/logger'
import {
  type ReferenceFrameLike,
  sharesReferenceFrame,
} from '../utils/derivedDataset'
import {
  type DerivedDataContext,
  notifyVisualizationError,
} from './derivedDataContext'
import { loadSeriesMetadata } from './loadSeriesMetadata'

export interface LoadReferencedOverlaySeriesOptions<
  T extends ReferenceFrameLike,
> {
  session: DerivedDataContext['session']
  client: DicomWebManager
  studyInstanceUID: string
  modality: string
  label: string
  onChange: () => void
  createItem: (metadata: dwc.api.Metadata) => T
  getSopInstanceUID?: (item: T) => string | undefined
  addItems: (items: T[]) => void
  applyPalettes: () => void
  /** When true, warn (console) for instances that fail the frame check */
  warnOnSkipped?: boolean
  errorMessage: string
  errorLogLabel: string
}

/**
 * Search one modality, keep instances that share the slide's frame of
 * reference, add them to the viewer, and apply distinct palettes.
 */
export async function loadReferencedOverlaySeries<
  T extends ReferenceFrameLike,
>({
  session,
  client,
  studyInstanceUID,
  modality,
  label,
  onChange,
  createItem,
  getSopInstanceUID,
  addItems,
  applyPalettes,
  warnOnSkipped = false,
  errorMessage,
  errorLogLabel,
}: LoadReferencedOverlaySeriesOptions<T>): Promise<void> {
  await loadSeriesMetadata({
    isCurrent: () => !session.isDestroyed,
    client,
    studyInstanceUID,
    modality,
    label,
    onMetadata: (retrievedMetadata) => {
      if (session.isDestroyed) return
      const reference = session.slide.volumeImages[0]
      const items: T[] = []
      /** A malformed instance is skipped; the valid ones still load */
      let hasMalformedInstance = false
      for (const metadata of retrievedMetadata) {
        let item: T
        try {
          item = createItem(metadata)
        } catch (error: unknown) {
          hasMalformedInstance = true
          logger.error(`${errorLogLabel}: could not read an instance: `, error)
          continue
        }
        if (sharesReferenceFrame(item, reference)) {
          items.push(item)
        } else if (warnOnSkipped) {
          const uid = getSopInstanceUID?.(item) ?? 'unknown'
          /** console.warn (not logger) so the header notifications list it */
          console.warn(`skip ${label} instance "${uid}"`)
        }
      }
      if (hasMalformedInstance) notifyVisualizationError(errorMessage)
      if (items.length === 0) return
      try {
        addItems(items)
        applyPalettes()
      } catch (error: unknown) {
        notifyVisualizationError(errorMessage)
        logger.error(`${errorLogLabel}: `, error)
      }
      onChange()
    },
  })
}
