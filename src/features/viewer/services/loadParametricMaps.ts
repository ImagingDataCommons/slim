/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'

import { StorageClasses } from '../../../data/uids'
import { applyDistinctParametricMapPalettes } from '../../../utils/distinctOverlayColormaps'
import type { DerivedDataContext } from './derivedDataContext'
import { loadReferencedOverlaySeries } from './loadReferencedOverlaySeries'

/** Add the study's parametric maps of this slide */
export async function loadParametricMaps({
  session,
  clients,
  studyInstanceUID,
  onChange,
}: DerivedDataContext): Promise<void> {
  await loadReferencedOverlaySeries({
    session,
    client: clients[StorageClasses.PARAMETRIC_MAP],
    studyInstanceUID,
    modality: 'OT',
    label: 'Parametric Map',
    onChange,
    createItem: (metadata) => new dmv.metadata.ParametricMap({ metadata }),
    getSopInstanceUID: (item) => item.SOPInstanceUID,
    addItems: (items) => session.volumeViewer.addParameterMappings(items),
    applyPalettes: () =>
      applyDistinctParametricMapPalettes(session.volumeViewer),
    warnOnSkipped: true,
    errorMessage: 'Parametric Map cannot be displayed',
    errorLogLabel: 'failed to add mappings',
  })
}
