import { useState } from 'react'

import { logger } from '../../../utils/logger'
import type { DmvEventHandlers } from '../services/dmvEvents'
import type { ViewerSession } from '../services/viewerSession'
import { withItem, withItems, withoutItem } from '../utils/uidSets'
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
  const [isInterpolationEnabled, setIsInterpolationEnabled] = useState(true)

  return {
    visibleUIDs,
    isInterpolationEnabled,
    reset: () => {
      setVisibleUIDs(new Set())
    },
    showSeries: (session, seriesInstanceUID) => {
      const allMappings = session.volumeViewer.getAllParameterMappings()
      const matching = allMappings.filter(
        (mapping) => mapping.seriesInstanceUID === seriesInstanceUID,
      )
      logger.debug(
        'auto-load Parametric Map: found ' +
          `${matching.length} matching mapping(s) ` +
          `out of ${allMappings.length} total ` +
          `for series "${seriesInstanceUID}"`,
      )
      const shown: string[] = []
      for (const mapping of matching) {
        try {
          session.volumeViewer.showParameterMapping(mapping.uid)
          shown.push(mapping.uid)
        } catch (error) {
          logger.error(
            `failed to auto-show parameter mapping "${mapping.uid}":`,
            error,
          )
        }
      }
      logger.debug(
        'auto-load Parametric Map: showing ' +
          `${shown.length}/${matching.length} mapping(s)`,
      )
      if (shown.length > 0) {
        setVisibleUIDs((current) => withItems(current, shown))
      }
      logger.debug('Loading Parametric Map')
    },
    onVisibilityChange: ({ mappingUID, isVisible }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log(`change visibility of mapping ${mappingUID}`)
      if (isVisible) {
        logger.log(`show mapping ${mappingUID}`)
        viewer.showParameterMapping(mappingUID)
        setVisibleUIDs((current) => withItem(current, mappingUID))
      } else {
        logger.log(`hide mapping ${mappingUID}`)
        viewer.hideParameterMapping(mappingUID)
        setVisibleUIDs((current) => withoutItem(current, mappingUID))
      }
    },
    onStyleChange: ({ mappingUID, styleOptions }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log(`change style of mapping ${mappingUID}`)
      viewer.setParameterMappingStyle(mappingUID, styleOptions)
      refreshSnapshot()
    },
    onDisplaySettingsChange: ({ interpolationEnabled }) => {
      setIsInterpolationEnabled(interpolationEnabled)
      sessionRef.current?.volumeViewer.toggleParametricMapInterpolation()
    },
    dmvHandlers: {
      dicommicroscopyviewer_parameter_mapping_visibility_changed: (payload) => {
        /**
         * The in-viewport legend already changed the overlay; only mirror
         * it into the panel.
         */
        if (payload?.mappingUID == null || payload.isVisible == null) return
        const { mappingUID, isVisible } = payload
        setVisibleUIDs((current) =>
          isVisible
            ? withItem(current, mappingUID)
            : withoutItem(current, mappingUID),
        )
      },
    },
  }
}
