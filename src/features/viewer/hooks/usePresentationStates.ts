/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import { useState } from 'react'
import type { Location, NavigateFunction } from 'react-router-dom'

import type DicomWebManager from '../../../DicomWebManager'
import { StorageClasses } from '../../../data/uids'
import { logger } from '../../../utils/logger'
import { notifyVisualizationError } from '../services/derivedDataLoaders'
import { loadPresentationStates } from '../services/presentationStates'
import type { ViewerSession, ViewerSessionRef } from '../services/viewerSession'
import {
  shouldApplyPresentationState,
  upsertBySopInstanceUID,
} from '../utils/presentationState'
import { useLatestRef } from './useLatestRef'
import type { OpticalPathsApi } from './useOpticalPaths'

type PresentationState = dmv.metadata.AdvancedBlendingPresentationState

export interface PresentationStatesApi {
  presentationStates: PresentationState[]
  selectedUID: string | undefined
  /** Retrieve the study's presentation states for new viewers */
  load: (session: ViewerSession) => void
  onSelect: (value?: string) => void
  onReset: () => void
}

/**
 * Advanced Blending Presentation States of the study: the list, the one
 * applied, and the `state` URL parameter naming it.
 */
export function usePresentationStates({
  sessionRef,
  clients,
  studyInstanceUID,
  requestedUID,
  location,
  navigate,
  opticalPaths,
}: {
  sessionRef: ViewerSessionRef
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  /** Presentation state named in the URL */
  requestedUID: string | undefined
  location: Location
  navigate: NavigateFunction
  opticalPaths: Pick<OpticalPathsApi, 'showDefault' | 'showPresentationState'>
}): PresentationStatesApi {
  const [presentationStates, setPresentationStates] = useState<
    PresentationState[]
  >([])
  const [selectedUID, setSelectedUID] = useState(requestedUID)
  /** Retrievals finish later; they must see the URL of that moment */
  const latestRef = useLatestRef({ requestedUID, location, opticalPaths })

  const apply = (
    session: ViewerSession,
    presentationState: PresentationState,
  ): void => {
    const { location: currentLocation, opticalPaths: currentOpticalPaths } =
      latestRef.current
    currentOpticalPaths.showPresentationState(session, presentationState)
    const searchParams = new URLSearchParams(currentLocation.search)
    searchParams.set('state', presentationState.SOPInstanceUID)
    navigate(
      {
        pathname: currentLocation.pathname,
        search: searchParams.toString(),
      },
      { replace: true },
    )
    setSelectedUID(presentationState.SOPInstanceUID)
  }

  const onReset = (): void => {
    const session = sessionRef.current
    setSelectedUID(undefined)
    navigate(location.pathname)
    if (session !== undefined) opticalPaths.showDefault(session)
  }

  return {
    presentationStates,
    selectedUID,
    load: (session) => {
      setPresentationStates([])
      loadPresentationStates({
        client: clients[StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE],
        studyInstanceUID,
        slide: session.slide,
        onPresentationState: (presentationState, index) => {
          if (session.isDestroyed) return
          if (
            shouldApplyPresentationState({
              index,
              sopInstanceUID: presentationState.SOPInstanceUID,
              requestedUID: latestRef.current.requestedUID,
            })
          ) {
            apply(session, presentationState)
          }
          setPresentationStates((current) =>
            upsertBySopInstanceUID(current, presentationState),
          )
        },
      })
    },
    onSelect: (value) => {
      if (value !== undefined) {
        logger.log(`select Presentation State instance "${value}"`)
        const presentationState = presentationStates.find(
          (instance) => instance.SOPInstanceUID === value,
        )
        const session = sessionRef.current
        if (presentationState !== undefined && session !== undefined) {
          navigate(`${location.pathname}?state=${value}`)
          apply(session, presentationState)
        } else {
          notifyVisualizationError('Presentation State could not be found')
          logger.log(
            'failed to handle section of presentation state: ' +
              `could not find instance "${value}"`,
          )
        }
      } else {
        onReset()
      }
      setSelectedUID(value)
    },
    onReset,
  }
}
