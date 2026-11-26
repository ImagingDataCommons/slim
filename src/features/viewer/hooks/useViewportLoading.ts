import { useEffect, useReducer, useRef } from 'react'

import { StorageClasses } from '../../../data/uids'
import { logger } from '../../../utils/logger'
import { notifyVisualizationError } from '../services/derivedDataLoaders'
import type { DmvEventHandlers } from '../services/dmvEvents'
import type { ViewerSession, ViewerSessionRef } from '../services/viewerSession'
import { hasIccProfile } from '../utils/iccProfile'
import {
  INITIAL_OVERLAY_LOADING,
  type OverlayKind,
  type OverlayStatus,
  overlayLoadingReducer,
  overlayStatus,
} from '../utils/overlayLoading'
import { recordFrameStatistics } from '../utils/pixelStatistics'
import {
  INITIAL_VIEWPORT_LOADING,
  isViewportLoading,
  viewportLoadingReducer,
  viewportStatusLabel,
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
  /**
   * What the viewport status pill says while the slide is not settled: its
   * first image, or the ICC color profile that redraws it. None when settled
   */
  statusLabel: string | undefined
  /** The image is being drawn again after an ICC profile toggle */
  isUpdatingColors: boolean
  /** Segments, parametric maps or annotations shown are still loading */
  isLoadingOverlays: boolean
  /** What the overlay status pill says while they load; none otherwise */
  overlayStatus: OverlayStatus | undefined
  /**
   * Announce the redraw that follows an ICC profile toggle; `swap` settles
   * once DMV swapped its tile loaders
   */
  colorProfileToggled: (swap?: PromiseLike<unknown>) => void
  /** Back to waiting, for the new viewers of `session` */
  reset: (session: ViewerSession) => void
  dmvHandlers: LoadingEventHandlers
}

/**
 * After this long without the profile applied (a failed or empty fetch,
 * which DMV only logs), the status pill stops announcing it
 */
const COLOR_PROFILE_TIMEOUT_MS = 20_000

/**
 * Overlay loads that report no end for this long are dropped from the pill,
 * so a lost event cannot leave it up for good
 */
const OVERLAY_STALE_MS = 60_000

/** What a frame of this storage class draws over the slide, if anything */
function overlayKindOf(
  sopClassUID: string | undefined,
): OverlayKind | undefined {
  switch (sopClassUID) {
    case StorageClasses.SEGMENTATION:
    case StorageClasses.LABELMAP_SEGMENTATION:
      return 'segments'
    case StorageClasses.PARAMETRIC_MAP:
      return 'maps'
    default:
      return undefined
  }
}

/** SOP Instance UIDs of each session's volume images, built once per session */
const volumeInstanceUIDs = new WeakMap<ViewerSession, ReadonlySet<string>>()

/**
 * Whether a frame belongs to the slide in the main viewport. DMV publishes
 * on `document.body`, so study thumbnails and the label viewer send frame
 * events too; their small frames finish first and must neither end the
 * first-image wait nor set a channel's window statistics.
 */
function isVolumeFrame(
  session: ViewerSession,
  sopInstanceUID: string,
): boolean {
  let uids = volumeInstanceUIDs.get(session)
  if (uids === undefined) {
    uids = new Set(
      session.slide.volumeImages.map((image) => image.SOPInstanceUID),
    )
    volumeInstanceUIDs.set(session, uids)
  }
  return uids.has(sopInstanceUID)
}

/**
 * Loading state of the viewport from DMV loading events. Monochrome frames
 * also feed the per-channel pixel statistics used for default windows.
 */
export function useViewportLoading(
  sessionRef: ViewerSessionRef,
): ViewportLoadingApi {
  /**
   * Bumped by each ICC toggle and each reset, so a swap that settles after a
   * newer toggle or another slide is ignored
   */
  const colorProfileToggleRef = useRef(0)
  const [loading, dispatch] = useReducer(
    viewportLoadingReducer,
    INITIAL_VIEWPORT_LOADING,
  )
  const [overlays, dispatchOverlays] = useReducer(
    overlayLoadingReducer,
    INITIAL_OVERLAY_LOADING,
  )
  /**
   * Bulk annotation loads in flight, oldest first. DMV's loading events carry
   * no id, so each end settles the oldest start
   */
  const annotationLoadsRef = useRef<string[]>([])
  const annotationLoadCountRef = useRef(0)
  const settleAnnotationLoad = (): void => {
    const key = annotationLoadsRef.current.shift()
    if (key !== undefined) dispatchOverlays({ type: 'settled', key })
  }

  const dmvHandlers: LoadingEventHandlers = {
    dicommicroscopyviewer_loading_started: () => {
      dispatch({ type: 'loadingStarted' })
      /** DMV reports only bulk annotation loads this way */
      annotationLoadCountRef.current += 1
      const key = `annotations-${String(annotationLoadCountRef.current)}`
      annotationLoadsRef.current.push(key)
      dispatchOverlays({ type: 'started', key, kind: 'annotations' })
    },
    dicommicroscopyviewer_loading_ended: () => {
      dispatch({ type: 'loadingEnded' })
      settleAnnotationLoad()
    },
    dicommicroscopyviewer_loading_error: (error) => {
      settleAnnotationLoad()
      const message = error?.message ?? 'Failed to load data'
      logger.error(message)
      dispatch({ type: 'loadingFailed' })
      notifyVisualizationError(message)
    },
    dicommicroscopyviewer_frame_loading_started: (frameInfo) => {
      const session = sessionRef.current
      if (session === undefined) return
      if (!isVolumeFrame(session, frameInfo.sopInstanceUID)) {
        const kind = overlayKindOf(frameInfo.sopClassUID)
        if (kind !== undefined) {
          dispatchOverlays({
            type: 'started',
            key: `${frameInfo.sopInstanceUID}-${frameInfo.frameNumber}`,
            kind,
          })
        }
        return
      }
      session.loadingFrames.add(
        `${frameInfo.sopInstanceUID}-${frameInfo.frameNumber}`,
      )
      dispatch({
        type: 'frameStarted',
        hasColorProfiles: session.volumeViewer.getICCProfiles().length > 0,
      })
    },
    dicommicroscopyviewer_frame_loading_ended: (frameInfo) => {
      const session = sessionRef.current
      if (session === undefined) return
      if (!isVolumeFrame(session, frameInfo.sopInstanceUID)) {
        dispatchOverlays({
          type: 'settled',
          key: `${frameInfo.sopInstanceUID}-${frameInfo.frameNumber}`,
        })
        return
      }
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
        recordFrameStatistics(
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

  /** Restarted by every overlay event; fires only when they stop coming */
  useEffect(() => {
    if (overlays.pending.size === 0) return
    const timer = setTimeout(() => {
      annotationLoadsRef.current = []
      dispatchOverlays({ type: 'reset' })
    }, OVERLAY_STALE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [overlays])

  const { colorProfile, isColorProfileToggle } = loading
  /** Busy cursor over the whole page while a toggle redraws the image */
  useEffect(() => {
    if (!isColorProfileToggle) return
    document.body.classList.add('cursor-progress')
    return () => {
      document.body.classList.remove('cursor-progress')
    }
  }, [isColorProfileToggle])
  /**
   * Loaded frames are decoded and color corrected before they are drawn, so
   * the announcement lasts until the map has rendered every tile in view
   */
  useEffect(() => {
    if (colorProfile !== 'drawing') return
    const map = sessionRef.current?.volumeViewer.getMap()
    if (map === undefined) {
      dispatch({ type: 'colorProfileDrawn' })
      return
    }
    const onRenderComplete = (): void => {
      dispatch({ type: 'colorProfileDrawn' })
    }
    map.on('rendercomplete', onRenderComplete)
    /**
     * Ask for a frame, so a map that already finished rendering before this
     * listener was attached still reports rendercomplete
     */
    map.render()
    return () => {
      map.un('rendercomplete', onRenderComplete)
    }
  }, [colorProfile, sessionRef])
  useEffect(() => {
    if (colorProfile === 'none') return
    const timer = setTimeout(() => {
      dispatch({ type: 'colorProfileTimedOut' })
    }, COLOR_PROFILE_TIMEOUT_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [colorProfile])

  return {
    isLoading: loading.isLoading,
    isWaitingForFirstImage: isViewportLoading(loading.phase),
    statusLabel: viewportStatusLabel(loading),
    isUpdatingColors: isColorProfileToggle,
    isLoadingOverlays: overlays.pending.size > 0,
    overlayStatus: overlayStatus(overlays),
    colorProfileToggled: (swap) => {
      colorProfileToggleRef.current += 1
      const toggle = colorProfileToggleRef.current
      const isCurrent = (): boolean => toggle === colorProfileToggleRef.current
      dispatch({ type: 'colorProfileToggled', awaitsSwap: swap !== undefined })
      swap?.then(
        () => {
          if (isCurrent()) dispatch({ type: 'colorProfileSwapped' })
        },
        () => {
          if (isCurrent()) dispatch({ type: 'colorProfileTimedOut' })
        },
      )
    },
    reset: (session) => {
      colorProfileToggleRef.current += 1
      annotationLoadsRef.current = []
      dispatchOverlays({ type: 'reset' })
      const image = session.slide.volumeImages[0]
      dispatch({
        type: 'reset',
        /** New viewers start with ICC profiles enabled */
        expectsColorProfile:
          image !== undefined &&
          !session.slide.areVolumeImagesMonochrome &&
          hasIccProfile(image),
      })
    },
    dmvHandlers,
  }
}
