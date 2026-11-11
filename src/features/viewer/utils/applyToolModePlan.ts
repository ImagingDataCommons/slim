/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import type { ToolModePlan } from './annotationToolModes'

/** Apply a tool-mode plan to the volume viewer. */
export function applyToolModePlan(
  viewer: dmv.viewer.VolumeImageViewer,
  plan: ToolModePlan,
): void {
  for (const interaction of plan.deactivate) {
    switch (interaction) {
      case 'draw':
        viewer.deactivateDrawInteraction()
        break
      case 'modify':
        viewer.deactivateModifyInteraction()
        break
      case 'snap':
        viewer.deactivateSnapInteraction()
        break
      case 'translate':
        viewer.deactivateTranslateInteraction()
        break
      case 'select':
        viewer.deactivateSelectInteraction()
        break
    }
  }
  if (plan.activateSelect) {
    viewer.activateSelectInteraction({})
  }
}
