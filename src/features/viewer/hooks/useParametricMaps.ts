import { useState } from 'react'

import { logger } from '../../../utils/logger'
import type { DmvEventHandlers } from '../services/dmvEvents'
import type { ViewerSession } from '../services/viewerSession'
import { showMatchingSeriesItems } from '../utils/showSeriesItems'
import { applyUidVisibility, mirrorDmvVisibility } from '../utils/uidVisibility'
import { useInterpolationToggle } from './useInterpolationToggle'
import type { ViewerAccess } from './useViewerSession'

export interface ParametricMapsApi {
  visibleUIDs: Set<string>
  isInterpolationEnabled: boolean
  /** New viewers start with no mapping shown */
  reset: () => void
  /** Show the mappings of a series opened through the URL */
  showSeries: (session: ViewerSession, seriesInstanceUID: string) => void
  onVisibilityChange: (change: {
    mappingUID: string
    isVisible: boolean
  }) => void
  onStyleChange: (change: {
    mappingUID: string
    styleOptions: { opacity?: number }
  }) => void
  onDisplaySettingsChange: (settings: { interpolationEnabled: boolean }) => void
  dmvHandlers: Required<
    Pick<
      DmvEventHandlers,
      'dicommicroscopyviewer_parameter_mapping_visibility_changed'
    >
  >
}

/** Parameter mappings of the slide's parametric maps */
export function useParametricMaps({
  sessionRef,
  refreshSnapshot,
}: ViewerAccess): ParametricMapsApi {
  const [visibleUIDs, setVisibleUIDs] = useState<Set<string>>(() => new Set())
  const { isInterpolationEnabled, resetInterpolation, onInterpolationChange } =
    useInterpolationToggle(() =>
      sessionRef.current?.volumeViewer.toggleParametricMapInterpolation(),
    )

  return {
    visibleUIDs,
    isInterpolationEnabled,
    reset: () => {
      setVisibleUIDs(new Set())
      resetInterpolation()
    },
    showSeries: (session, seriesInstanceUID) => {
      showMatchingSeriesItems({
        items: session.volumeViewer.getAllParameterMappings(),
        seriesInstanceUID,
        label: 'Parametric Map',
        getSeriesInstanceUID: (mapping) => mapping.seriesInstanceUID,
        getId: (mapping) => mapping.uid,
        show: (uid) => session.volumeViewer.showParameterMapping(uid),
        setVisible: setVisibleUIDs,
      })
    },
    onVisibilityChange: ({ mappingUID, isVisible }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log(`change visibility of mapping ${mappingUID}`)
      applyUidVisibility({
        uid: mappingUID,
        isVisible,
        show: (uid) => {
          logger.log(`show mapping ${uid}`)
          viewer.showParameterMapping(uid)
        },
        hide: (uid) => {
          logger.log(`hide mapping ${uid}`)
          viewer.hideParameterMapping(uid)
        },
        setVisibleUIDs,
      })
    },
    onStyleChange: ({ mappingUID, styleOptions }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log(`change style of mapping ${mappingUID}`)
      viewer.setParameterMappingStyle(mappingUID, styleOptions)
      refreshSnapshot()
    },
    onDisplaySettingsChange: ({ interpolationEnabled }) => {
      onInterpolationChange(interpolationEnabled)
    },
    dmvHandlers: {
      dicommicroscopyviewer_parameter_mapping_visibility_changed: (payload) => {
        /**
         * The in-viewport legend already changed the overlay; only mirror
         * it into the panel.
         */
        mirrorDmvVisibility(
          setVisibleUIDs,
          payload?.mappingUID,
          payload?.isVisible,
        )
      },
    },
  }
}
