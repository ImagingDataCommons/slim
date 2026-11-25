/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'

import { StorageClasses } from '../../../data/uids'
import { applyDistinctFractionalSegmentPalettes } from '../../../utils/distinctOverlayColormaps'
import type { DerivedDataContext } from './derivedDataContext'
import { loadReferencedOverlaySeries } from './loadReferencedOverlaySeries'

/** Add the study's segmentations of this slide */
export async function loadSegmentations({
  session,
  clients,
  studyInstanceUID,
  onChange,
}: DerivedDataContext): Promise<void> {
  await loadReferencedOverlaySeries({
    session,
    client: clients[StorageClasses.SEGMENTATION],
    studyInstanceUID,
    modality: 'SEG',
    label: 'Segmentation',
    onChange,
    createItem: (metadata) => new dmv.metadata.Segmentation({ metadata }),
    addItems: (items) => session.volumeViewer.addSegments(items),
    applyPalettes: () =>
      applyDistinctFractionalSegmentPalettes(session.volumeViewer),
    errorMessage: 'Segmentations cannot be displayed',
    errorLogLabel: 'failed to add segments',
  })
}
