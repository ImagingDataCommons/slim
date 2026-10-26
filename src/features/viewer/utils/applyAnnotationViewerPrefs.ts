/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import { logger } from '../../../utils/logger'
import type { MeasurementUnit } from '../../preferences/utils/preferences'

type AnnotationPrefsViewer = Partial<
  Pick<
    dmv.viewer.VolumeImageViewer,
    'setMeasurementUnit' | 'setMarkupLabelColor' | 'setMarkupLabelFontSize'
  >
>

let warnedMissingDmvPrefsApi = false

/** Push measurement unit + label style into a live DMV volume viewer. */
export function applyAnnotationViewerPrefs(
  volumeViewer: AnnotationPrefsViewer,
  prefs: {
    units: MeasurementUnit
    markupLabelColor: string
    markupLabelFontSize: number
  },
): void {
  const canSetUnit = typeof volumeViewer.setMeasurementUnit === 'function'
  const canSetColor = typeof volumeViewer.setMarkupLabelColor === 'function'
  const canSetFontSize =
    typeof volumeViewer.setMarkupLabelFontSize === 'function'

  if (!canSetUnit || !canSetColor || !canSetFontSize) {
    if (!warnedMissingDmvPrefsApi) {
      warnedMissingDmvPrefsApi = true
      logger.warn(
        'DMV is missing measurement-label preference APIs. ' +
          'Restart `pnpm start` after linking a rebuilt dicom-microscopy-viewer.',
      )
    }
  }

  if (canSetUnit) {
    volumeViewer.setMeasurementUnit?.(prefs.units)
  }
  if (canSetColor) {
    volumeViewer.setMarkupLabelColor?.(prefs.markupLabelColor)
  }
  if (canSetFontSize) {
    volumeViewer.setMarkupLabelFontSize?.(prefs.markupLabelFontSize)
  }
}
