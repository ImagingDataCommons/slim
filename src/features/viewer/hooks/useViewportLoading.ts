import { useReducer } from 'react'

import { StorageClasses } from '../../../data/uids'
import { logger } from '../../../utils/logger'
import { notifyVisualizationError } from '../services/derivedDataLoaders'
import type { DmvEventHandlers } from '../services/dmvEvents'
import type { ViewerSessionRef } from '../services/viewerSession'
import { recordFirstFrameStatistics } from '../utils/pixelStatistics'
import {
  INITIAL_VIEWPORT_LOADING,
  isViewportLoading,
  viewportLoadingReducer,
} from '../utils/viewportLoading'

type LoadingEventHandlers = Required<
  Pick<
    DmvEventHandlers,
    | 'dicommicroscopyviewer_loading_started'
    | 'dicommicroscopyviewer_loading_ended'
    | 'dicommicroscopyviewer_loading_error'
    | 'dicommicroscopyviewer_frame_loading_started'
    | 'dicommicroscopyviewer_frame_loading_ended'
    | 'dicommicroscopyviewer_frame_loading_error'
  >
>

export interface ViewportLoadingApi {
  /** Data is being fetched; shows the busy cursor */
  isLoading: boolean
  /** The first image of the slide has not arrived yet */
  isWaitingForFirstImage: boolean
  /** Back to waiting, for new viewers */
  reset: () => void
  dmvHandlers: LoadingEventHandlers
}

/**
 * Loading state of the viewport from DMV loading events. Monochrome frames
 * also feed the per-channel pixel statistics used for default windows.
 */
export function useViewportLoading(
  sessionRef: ViewerSessionRef,
): ViewportLoadingApi {
  const [loading, dispatch] = useReducer(
    viewportLoadingReducer,
    INITIAL_VIEWPORT_LOADING,
  )

  const dmvHandlers: LoadingEventHandlers = {
    dicommicroscopyviewer_loading_started: () => {
      dispatch({ type: 'loadingStarted' })
    },
    dicommicroscopyviewer_loading_ended: () => {
      dispatch({ type: 'loadingEnded' })
    },
    dicommicroscopyviewer_loading_error: (error) => {
      const message = error?.message ?? 'Failed to load data'
      logger.error(message)
      dispatch({ type: 'loadingFailed' })
      notifyVisualizationError(message)
    },
    dicommicroscopyviewer_frame_loading_started: (frameInfo) => {
      sessionRef.current?.loadingFrames.add(
        `${frameInfo.sopInstanceUID}-${frameInfo.frameNumber}`,
      )
    },
    dicommicroscopyviewer_frame_loading_ended: (frameInfo) => {
      const session = sessionRef.current
      if (session === undefined) return
      session.loadingFrames.delete(
        `${frameInfo.sopInstanceUID}-${frameInfo.frameNumber}`,
      )
      dispatch({
        type: 'frameSettled',
        hasPendingFrames: session.loadingFrames.size > 0,
      })
      if (
        frameInfo.sopClassUID ===
          StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE &&
        session.slide.areVolumeImagesMonochrome
      ) {
        recordFirstFrameStatistics(
          session.pixelStatistics,
          frameInfo.channelIdentifier,
          frameInfo.pixelArray,
        )
      }
    },
    dicommicroscopyviewer_frame_loading_error: () => {
      logger.error('Failed to load frame')
    },
  }

  return {
    isLoading: loading.isLoading,
    isWaitingForFirstImage: isViewportLoading(loading.phase),
    reset: () => {
      dispatch({ type: 'reset' })
    },
    dmvHandlers,
  }
}
