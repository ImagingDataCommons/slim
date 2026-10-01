/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useState } from 'react'

import { logger } from '../../../utils/logger'
import {
  applyDefaultPresentationState,
  applyPresentationState,
} from '../services/presentationStates'
import type { ViewerSession } from '../services/viewerSession'
import { changedSettingKeys } from '../utils/displaySettings'
import { sortByIdentifier } from '../utils/opticalPathOrder'
import { withItem, withItems, withoutItem } from '../utils/uidSets'
import type { ViewerAccess } from './useViewerSession'

export interface OpticalPathDisplaySettings {
  iccProfileEnabled: boolean
  gammaEnabled: boolean
}

export interface OpticalPathsApi {
  visibleIdentifiers: Set<string>
  activeIdentifiers: Set<string>
  displaySettings: OpticalPathDisplaySettings
  /** Gamma correction the user picked, to carry over to new viewers */
  gammaCorrection: boolean | undefined
  /** New viewers start with ICC profiles enabled */
  reset: () => void
  showDefault: (session: ViewerSession) => void
  showPresentationState: (
    session: ViewerSession,
    presentationState: dmv.metadata.AdvancedBlendingPresentationState,
  ) => void
  /** Show the paths of a series opened through the URL */
  showSeries: (session: ViewerSession, seriesInstanceUID: string) => void
  onVisibilityChange: (change: {
    opticalPathIdentifier: string
    isVisible: boolean
  }) => void
  onActivityChange: (change: {
    opticalPathIdentifier: string
    isActive: boolean
  }) => void
  onStyleChange: (change: {
    opticalPathIdentifier: string
    styleOptions: { opacity?: number; color?: number[]; limitValues?: number[] }
  }) => void
  onDisplaySettingsChange: (settings: OpticalPathDisplaySettings) => void
}

/** Which optical paths are shown and blended, and how colors are managed */
export function useOpticalPaths(
  { sessionRef, refreshSnapshot }: ViewerAccess,
  viewerGammaCorrection: boolean,
): OpticalPathsApi {
  const [visibleIdentifiers, setVisibleIdentifiers] = useState<Set<string>>(
    () => new Set(),
  )
  const [activeIdentifiers, setActiveIdentifiers] = useState<Set<string>>(
    () => new Set(),
  )
  const [isIccProfileEnabled, setIsIccProfileEnabled] = useState(true)
  const [gammaCorrection, setGammaCorrection] = useState<boolean | undefined>(
    undefined,
  )
  const displaySettings: OpticalPathDisplaySettings = {
    iccProfileEnabled: isIccProfileEnabled,
    gammaEnabled: gammaCorrection ?? viewerGammaCorrection,
  }

  const showIdentifiers = (shown: Set<string>): void => {
    setVisibleIdentifiers(new Set(shown))
    setActiveIdentifiers(new Set(shown))
    refreshSnapshot()
  }

  return {
    visibleIdentifiers,
    activeIdentifiers,
    displaySettings,
    gammaCorrection,
    reset: () => {
      setIsIccProfileEnabled(true)
    },
    showDefault: (session) => {
      const { volumeViewer } = session
      showIdentifiers(
        applyDefaultPresentationState(
          volumeViewer,
          sortByIdentifier(volumeViewer.getAllOpticalPaths()),
          session.pixelStatistics,
        ),
      )
    },
    showPresentationState: (session, presentationState) => {
      showIdentifiers(
        applyPresentationState(session.volumeViewer, presentationState),
      )
    },
    showSeries: (session, seriesInstanceUID) => {
      const allOpticalPaths = session.volumeViewer.getAllOpticalPaths()
      const matching = allOpticalPaths.filter(
        (opticalPath) => opticalPath.seriesInstanceUID === seriesInstanceUID,
      )
      logger.debug(
        'auto-load Optical Path: found ' +
          `${matching.length} matching optical path(s) ` +
          `out of ${allOpticalPaths.length} total ` +
          `for series "${seriesInstanceUID}"`,
      )
      const shown: string[] = []
      for (const { identifier } of matching) {
        try {
          session.volumeViewer.showOpticalPath(identifier)
          shown.push(identifier)
        } catch (error) {
          logger.error(
            `failed to auto-show optical path "${identifier}":`,
            error,
          )
        }
      }
      logger.debug(
        'auto-load Optical Path: showing ' +
          `${shown.length}/${matching.length} optical path(s)`,
      )
      if (shown.length > 0) {
        setVisibleIdentifiers((current) => withItems(current, shown))
      }
      logger.debug('Loading Optical Path')
    },
    onVisibilityChange: ({ opticalPathIdentifier, isVisible }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log(`change visibility of optical path ${opticalPathIdentifier}`)
      if (isVisible) {
        logger.log(`show optical path ${opticalPathIdentifier}`)
        viewer.showOpticalPath(opticalPathIdentifier)
        setVisibleIdentifiers((current) =>
          withItem(current, opticalPathIdentifier),
        )
      } else {
        logger.log(`hide optical path ${opticalPathIdentifier}`)
        viewer.hideOpticalPath(opticalPathIdentifier)
        setVisibleIdentifiers((current) =>
          withoutItem(current, opticalPathIdentifier),
        )
      }
    },
    onActivityChange: ({ opticalPathIdentifier, isActive }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log(`change activity of optical path ${opticalPathIdentifier}`)
      if (isActive) {
        logger.log(`activate optical path ${opticalPathIdentifier}`)
        viewer.activateOpticalPath(opticalPathIdentifier)
        setActiveIdentifiers((current) =>
          withItem(current, opticalPathIdentifier),
        )
      } else {
        logger.log(`deactivate optical path ${opticalPathIdentifier}`)
        viewer.deactivateOpticalPath(opticalPathIdentifier)
        setActiveIdentifiers((current) =>
          withoutItem(current, opticalPathIdentifier),
        )
      }
    },
    onStyleChange: ({ opticalPathIdentifier, styleOptions }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log(`change style of optical path ${opticalPathIdentifier}`)
      viewer.setOpticalPathStyle(opticalPathIdentifier, styleOptions)
      refreshSnapshot()
    },
    onDisplaySettingsChange: (settings) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      const changed = changedSettingKeys(displaySettings, settings)
      if (changed.includes('iccProfileEnabled')) {
        setIsIccProfileEnabled(settings.iccProfileEnabled)
        viewer.toggleICCProfiles()
      }
      if (changed.includes('gammaEnabled')) {
        setGammaCorrection(settings.gammaEnabled)
        viewer.setPaletteDisplayGammaCorrectionEnabled(settings.gammaEnabled)
        refreshSnapshot()
      }
    },
  }
}
