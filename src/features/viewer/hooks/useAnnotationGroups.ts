/** skipcq: JS-C1003 */
import type * as dcmjs from 'dcmjs'
import { useState } from 'react'

import type { AnnotationGroupDisplaySettings } from '../../../components/AnnotationGroupList'
import { runValidations } from '../../../contexts/ValidationContext'
import type { Slide } from '../../../data/slides'
import { logger } from '../../../utils/logger'
import type { VisibilityChange } from '../../../utils/visibility'
import { notifyVisualizationError } from '../services/derivedDataLoaders'
import {
  applyClusteringOptions,
  type ViewerSession,
} from '../services/viewerSession'
import { applyEach } from '../utils/applyEach'
import {
  type ClusteringSettings,
  changedSettingKeys,
  shouldApplyClusteringSettings,
} from '../utils/displaySettings'
import { withItems } from '../utils/uidSets'
import { applyVisibilityChanges } from '../utils/visibilityChanges'
import type { ViewerAccess } from './useViewerSession'

export interface AnnotationGroupsApi {
  visibleUIDs: Set<string>
  /** Series filter of the panel; `undefined` lists every series */
  selectedSeriesUID: string | undefined
  clustering: ClusteringSettings
  displaySettings: AnnotationGroupDisplaySettings
  /** New viewers start with no group shown and no series filter */
  reset: () => void
  /** Show the groups of a series opened through the URL */
  showSeries: (session: ViewerSession, seriesInstanceUID: string) => void
  onVisibilityChange: (change: {
    annotationGroupUID: string
    isVisible: boolean
  }) => void
  onVisibilityChanges: (changes: VisibilityChange[]) => void
  onStyleChange: (change: {
    uid: string
    styleOptions: {
      opacity?: number
      color?: number[]
      measurement?: dcmjs.sr.coding.CodedConcept
      fill?: boolean
      fillOpacity?: number
    }
  }) => void
  onClick: (annotationGroupUID: string) => void
  onSeriesChange: (seriesInstanceUID: string) => void
  onDisplaySettingsChange: (settings: AnnotationGroupDisplaySettings) => void
}

/** Bulk annotation groups: visibility, styles and clustering */
export function useAnnotationGroups(
  { sessionRef, refreshSnapshot }: ViewerAccess,
  slide: Slide,
): AnnotationGroupsApi {
  const [visibleUIDs, setVisibleUIDs] = useState<Set<string>>(() => new Set())
  const [selectedSeriesUID, setSelectedSeriesUID] = useState<
    string | undefined
  >(undefined)
  const [clustering, setClustering] = useState<ClusteringSettings>({
    isEnabled: true,
    thresholdInput: '',
  })
  const displaySettings: AnnotationGroupDisplaySettings = {
    clusteringEnabled: clustering.isEnabled,
    clusteringThreshold: clustering.thresholdInput,
  }

  const onVisibilityChanges = (changes: VisibilityChange[]): void => {
    const viewer = sessionRef.current?.volumeViewer
    if (viewer === undefined) return
    const allAnnotationGroups = viewer.getAllAnnotationGroups()
    applyEach(
      changes,
      ({ uid, isVisible }): VisibilityChange => {
        const annotationGroup = allAnnotationGroups.find(
          (group) => group.uid === uid,
        )
        if (annotationGroup !== undefined) {
          runValidations({ dialog: true, context: { annotationGroup, slide } })
        }
        logger.log(`change visibility of annotation group ${uid}`)
        if (isVisible) {
          logger.log(`show annotation group ${uid}`)
          try {
            viewer.showAnnotationGroup(uid)
          } catch (error) {
            notifyVisualizationError('Failed to show annotation group.')
            throw error
          }
        } else {
          logger.log(`hide annotation group ${uid}`)
          viewer.hideAnnotationGroup(uid)
        }
        return { uid, isVisible }
      },
      (applied) => {
        if (applied.length > 0) {
          setVisibleUIDs((current) => applyVisibilityChanges(current, applied))
        }
      },
    )
  }

  return {
    visibleUIDs,
    selectedSeriesUID,
    clustering,
    displaySettings,
    reset: () => {
      setVisibleUIDs(new Set())
      setSelectedSeriesUID(undefined)
    },
    showSeries: (session, seriesInstanceUID) => {
      const allAnnotationGroups = session.volumeViewer.getAllAnnotationGroups()
      const matching = allAnnotationGroups.filter(
        (group) => group.seriesInstanceUID === seriesInstanceUID,
      )
      logger.debug(
        'auto-load Microscopy Bulk Simple Annotation: found ' +
          `${matching.length} matching annotation group(s) ` +
          `out of ${allAnnotationGroups.length} total ` +
          `for series "${seriesInstanceUID}"`,
      )
      /**
       * Unlike a manual toggle, no validation dialog is shown, and one
       * failing group must not keep the others hidden.
       */
      const shown: string[] = []
      for (const group of matching) {
        try {
          session.volumeViewer.showAnnotationGroup(group.uid)
          shown.push(group.uid)
        } catch (error) {
          logger.error(
            `failed to auto-show annotation group "${group.uid}":`,
            error,
          )
        }
      }
      logger.debug(
        'auto-load Microscopy Bulk Simple Annotation: showing ' +
          `${shown.length}/${matching.length} annotation group(s)`,
      )
      if (shown.length > 0) {
        setVisibleUIDs((current) => withItems(current, shown))
      }
      logger.debug('Loading Microscopy Bulk Simple Annotation')
    },
    onVisibilityChange: ({ annotationGroupUID, isVisible }) => {
      onVisibilityChanges([{ uid: annotationGroupUID, isVisible }])
    },
    onVisibilityChanges,
    onStyleChange: ({ uid, styleOptions }) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      logger.log(`change style of annotation group ${uid}`)
      try {
        viewer.setAnnotationGroupStyle(uid, styleOptions)
      } catch (error) {
        notifyVisualizationError('Failed to change style of annotation group.')
        throw error
      }
      refreshSnapshot()
    },
    onClick: (annotationGroupUID) => {
      sessionRef.current?.volumeViewer.zoomToROI(annotationGroupUID)
    },
    onSeriesChange: (seriesInstanceUID) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      /** Switching series hides every group shown for the previous one */
      for (const uid of visibleUIDs) viewer.hideAnnotationGroup(uid)
      setSelectedSeriesUID(seriesInstanceUID)
      setVisibleUIDs(new Set())
    },
    onDisplaySettingsChange: (settings) => {
      if (changedSettingKeys(displaySettings, settings).length === 0) return
      const next: ClusteringSettings = {
        isEnabled: settings.clusteringEnabled,
        thresholdInput: settings.clusteringThreshold,
      }
      if (
        clustering.isEnabled === next.isEnabled &&
        clustering.thresholdInput === next.thresholdInput
      ) {
        return
      }
      setClustering(next)
      const viewer = sessionRef.current?.volumeViewer
      if (
        viewer !== undefined &&
        shouldApplyClusteringSettings(clustering, next)
      ) {
        applyClusteringOptions(viewer, next)
      }
    },
  }
}
