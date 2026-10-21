/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { startTransition, useState } from 'react'

import { logger } from '../../../utils/logger'
import {
  applyDefaultPresentationState,
  applyPresentationState,
} from '../services/presentationStates'
import type { ViewerSession } from '../services/viewerSession'
import { changedSettingKeys } from '../utils/displaySettings'
import { sortByIdentifier } from '../utils/opticalPathOrder'
import { showMatchingSeriesItems } from '../utils/showSeriesItems'
import { withItem, withoutItem } from '../utils/uidSets'
import type { ViewerAccess } from './useViewerSession'

/** Late presentation states must not override what the user chose */
function markUserDisplayChange(session: ViewerSession | undefined): void {
  if (session !== undefined) session.hasUserDisplayChanges = true
}

function toggleOpticalPathFlag({
  id,
  enable,
  apply,
  setIds,
}: {
  id: string
  enable: boolean
  apply: (id: string) => void
  setIds: (update: (current: Set<string>) => Set<string>) => void
}): void {
  apply(id)
  startTransition(() => {
    setIds((current) =>
      enable ? withItem(current, id) : withoutItem(current, id),
    )
  })
}

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
  /**
   * Live style while a slider is dragged: restyles the slide only. The panel
   * snapshot is refreshed once, by {@link onStyleChange} on commit.
   */
  onStylePreview: (change: {
    opticalPathIdentifier: string
    styleOptions: { opacity?: number; color?: number[]; limitValues?: number[] }
  }) => void
  onDisplaySettingsChange: (
    settings: OpticalPathDisplaySettings,
    previous?: OpticalPathDisplaySettings,
  ) => void
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
    startTransition(() => {
      setVisibleIdentifiers(new Set(shown))
      setActiveIdentifiers(new Set(shown))
    })
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
      showMatchingSeriesItems({
        items: session.volumeViewer.getAllOpticalPaths(),
        seriesInstanceUID,
        label: 'Optical Path',
        getSeriesInstanceUID: (path) => path.seriesInstanceUID,
        getId: (path) => path.identifier,
        show: (id) => session.volumeViewer.showOpticalPath(id),
        setVisible: (update) => {
          startTransition(() => {
            setVisibleIdentifiers(update)
          })
        },
      })
    },
    onVisibilityChange: ({ opticalPathIdentifier, isVisible }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      markUserDisplayChange(sessionRef.current)
      logger.log(`change visibility of optical path ${opticalPathIdentifier}`)
      toggleOpticalPathFlag({
        id: opticalPathIdentifier,
        enable: isVisible,
        apply: (id) => {
          if (isVisible) {
            logger.log(`show optical path ${id}`)
            viewer.showOpticalPath(id)
          } else {
            logger.log(`hide optical path ${id}`)
            viewer.hideOpticalPath(id)
          }
        },
        setIds: setVisibleIdentifiers,
      })
    },
    onActivityChange: ({ opticalPathIdentifier, isActive }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      markUserDisplayChange(sessionRef.current)
      logger.log(`change activity of optical path ${opticalPathIdentifier}`)
      toggleOpticalPathFlag({
        id: opticalPathIdentifier,
        enable: isActive,
        apply: (id) => {
          if (isActive) {
            logger.log(`activate optical path ${id}`)
            viewer.activateOpticalPath(id)
          } else {
            logger.log(`deactivate optical path ${id}`)
            viewer.deactivateOpticalPath(id)
          }
        },
        setIds: setActiveIdentifiers,
      })
    },
    onStyleChange: ({ opticalPathIdentifier, styleOptions }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      markUserDisplayChange(sessionRef.current)
      logger.log(`change style of optical path ${opticalPathIdentifier}`)
      viewer.setOpticalPathStyle(opticalPathIdentifier, styleOptions)
      refreshSnapshot()
    },
    onStylePreview: ({ opticalPathIdentifier, styleOptions }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      markUserDisplayChange(sessionRef.current)
      viewer.setOpticalPathStyle(opticalPathIdentifier, styleOptions)
    },
    onDisplaySettingsChange: (settings, previous = displaySettings) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      /** Diff against `previous` so a toggle is never applied twice */
      const changed = changedSettingKeys(previous, settings)
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
