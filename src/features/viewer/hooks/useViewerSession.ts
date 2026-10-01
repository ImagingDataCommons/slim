/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type DicomWebManager from '../../../DicomWebManager'
import type { Slide } from '../../../data/slides'
import {
  clampOverviewMapInViewport,
  observeOverviewMapClamp,
} from '../../../utils/clampOverviewMapInViewport'
import { logger } from '../../../utils/logger'
import { subscribeDomEvents } from '../services/dmvEvents'
import {
  createViewerSession,
  destroyViewerSession,
  type ViewerSession,
  type ViewerSessionRef,
} from '../services/viewerSession'
import {
  EMPTY_VIEWER_SNAPSHOT,
  readViewerSnapshot,
  type ViewerSnapshot,
} from '../services/viewerSnapshot'
import type { AnnotationConfig } from '../utils/annotationConfig'
import type { ClusteringSettings } from '../utils/displaySettings'
import { useLatestRef } from './useLatestRef'

/** What the feature hooks need to reach the viewers */
export interface ViewerAccess {
  sessionRef: ViewerSessionRef
  /** Re-read the viewers after a change the panels show */
  refreshSnapshot: () => void
}

export interface ViewerStore extends ViewerAccess {
  sessionRef: React.RefObject<ViewerSession | undefined>
  snapshot: ViewerSnapshot
}

/**
 * The current viewer session and the immutable snapshot rendered from it.
 * Render reads only the snapshot; handlers refresh it after changing the
 * viewers.
 */
export function useViewerSnapshot(): ViewerStore {
  const sessionRef = useRef<ViewerSession | undefined>(undefined)
  /** Last snapshot handed out, so unchanged parts keep their identity */
  const snapshotRef = useRef<ViewerSnapshot>(EMPTY_VIEWER_SNAPSHOT)
  const [snapshot, setSnapshot] = useState<ViewerSnapshot>(
    EMPTY_VIEWER_SNAPSHOT,
  )
  const refreshSnapshot = useCallback((): void => {
    const session = sessionRef.current
    if (session === undefined || session.isDestroyed) return
    const next = readViewerSnapshot(session, snapshotRef.current)
    snapshotRef.current = next
    setSnapshot(next)
  }, [])
  return { sessionRef, snapshot, refreshSnapshot }
}

export interface ViewerSessionOptions {
  slide: Slide
  clients: { [key: string]: DicomWebManager }
  /** Route the viewers belong to; a change rebuilds them */
  routeKey: string
  preload: boolean
  annotationConfig: AnnotationConfig
  defaultRoiStyle: dmv.viewer.ROIStyleOptions
  clustering: ClusteringSettings
  /** Gamma correction chosen by the user, carried over to new viewers */
  gammaCorrection: boolean | undefined
  /** Called once the new viewers are rendered */
  onSessionCreated: (session: ViewerSession) => void
}

export interface ViewerSessionApi {
  volumeViewportRef: React.RefObject<HTMLDivElement | null>
  labelViewportRef: React.RefCallback<HTMLDivElement>
  onViewportResize: () => void
}

/**
 * Create and render the DMV viewers for every slide and route, and release
 * them on change, unload and unmount. Settings and `onSessionCreated` are
 * read when the viewers are created, without rebuilding them on change.
 */
export function useViewerSession(
  { sessionRef, refreshSnapshot }: ViewerStore,
  {
    slide,
    clients,
    routeKey,
    preload,
    annotationConfig,
    defaultRoiStyle,
    clustering,
    gammaCorrection,
    onSessionCreated,
  }: ViewerSessionOptions,
): ViewerSessionApi {
  const generationRef = useRef(0)
  const volumeViewportRef = useRef<HTMLDivElement>(null)
  const labelNodeRef = useRef<HTMLDivElement | null>(null)
  const renderedLabelRef = useRef<
    { viewer: dmv.viewer.LabelImageViewer; node: HTMLDivElement } | undefined
  >(undefined)
  const stopOverviewClampRef = useRef<(() => void) | undefined>(undefined)
  const creationRef = useLatestRef({
    preload,
    annotationConfig,
    defaultRoiStyle,
    clustering,
    gammaCorrection,
    onSessionCreated,
  })

  /** The label slot mounts after its viewer exists, so both sides call this */
  const renderLabelViewer = useCallback((): void => {
    const viewer = sessionRef.current?.labelViewer
    const node = labelNodeRef.current
    if (viewer === undefined || node === null) return
    const rendered = renderedLabelRef.current
    if (rendered?.viewer === viewer && rendered.node === node) return
    viewer.render({ container: node })
    renderedLabelRef.current = { viewer, node }
  }, [sessionRef])

  const labelViewportRef = useCallback(
    (node: HTMLDivElement | null): void => {
      labelNodeRef.current = node
      if (node === null) {
        renderedLabelRef.current = undefined
        return
      }
      renderLabelViewer()
    },
    [renderLabelViewer],
  )

  useEffect(() => {
    const options = creationRef.current
    logger.log(
      `view slide "${slide.containerIdentifier}" (${routeKey}): `,
      slide,
    )
    generationRef.current += 1
    const session = createViewerSession({
      generation: generationRef.current,
      slide,
      clients,
      preload: options.preload,
      clustering: options.clustering,
      annotationConfig: options.annotationConfig,
      defaultRoiStyle: options.defaultRoiStyle,
    })
    if (options.gammaCorrection !== undefined) {
      session.volumeViewer.setPaletteDisplayGammaCorrectionEnabled(
        options.gammaCorrection,
      )
    }
    sessionRef.current = session

    logger.log('populate viewports...')
    const container = volumeViewportRef.current
    if (container !== null) {
      session.volumeViewer.render({ container })
      stopOverviewClampRef.current = observeOverviewMapClamp(container, {
        volumeViewer: session.volumeViewer,
      })
    }
    renderLabelViewer()
    refreshSnapshot()
    options.onSessionCreated(session)

    return () => {
      stopOverviewClampRef.current?.()
      stopOverviewClampRef.current = undefined
      renderedLabelRef.current = undefined
      destroyViewerSession(session, {
        volume: volumeViewportRef.current,
        label: labelNodeRef.current,
      })
      if (sessionRef.current === session) sessionRef.current = undefined
    }
  }, [
    slide,
    clients,
    routeKey,
    sessionRef,
    creationRef,
    renderLabelViewer,
    refreshSnapshot,
  ])

  useEffect(
    () =>
      subscribeDomEvents(window, [
        [
          'beforeunload',
          () => {
            stopOverviewClampRef.current?.()
            stopOverviewClampRef.current = undefined
            const session = sessionRef.current
            if (session !== undefined) {
              destroyViewerSession(session, { volume: null, label: null })
            }
          },
        ],
      ]),
    [sessionRef],
  )

  /** Stable identity: the viewport's resize observer is set up once */
  const onViewportResize = useCallback((): void => {
    const session = sessionRef.current
    if (session === undefined || session.isDestroyed) return
    session.volumeViewer.resize()
    session.labelViewer?.resize()
    const container = volumeViewportRef.current
    if (container !== null) {
      clampOverviewMapInViewport(container, {
        volumeViewer: session.volumeViewer,
      })
    }
  }, [sessionRef])

  return { volumeViewportRef, labelViewportRef, onViewportResize }
}
