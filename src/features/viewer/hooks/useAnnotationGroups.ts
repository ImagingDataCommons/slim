/** skipcq: JS-C1003 */
import type * as dcmjs from 'dcmjs'
import { startTransition, useState } from 'react'

import type { AnnotationGroupDisplaySettings } from '../../../components/AnnotationGroupList'
import { runValidations } from '../../../contexts/ValidationContext'
import type { Slide } from '../../../data/slides'
import type { AnnotationGroupStyle } from '../../../types/layerStyles'
import { codedConceptKey } from '../../../utils/dicom/codedConcept'
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
import { showMatchingSeriesItems } from '../utils/showSeriesItems'
import { hideVisibleItems } from '../utils/uidVisibility'
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
  /**
   * Measurement key each group is colored by, kept here because DMV's style
   * getter does not report it and panel items remount
   */
  measurementKeys: Readonly<Record<string, string>>
  /**
   * Group styles from the viewer with the fill settings the user chose,
   * which DMV's style getter does not report either
   */
  withFillStyles: (
    styles: Readonly<Record<string, AnnotationGroupStyle>>,
  ) => Readonly<Record<string, AnnotationGroupStyle>>
  /**
   * Live style while a slider is dragged: restyles the slide only. The panel
   * snapshot is refreshed once, by onStyleChange on commit.
   */
  onStylePreview: (change: {
    uid: string
    styleOptions: { opacity?: number; color?: number[]; fillOpacity?: number }
  }) => void
  onClick: (annotationGroupUID: string) => void
  onSeriesChange: (seriesInstanceUID: string) => void
  onDisplaySettingsChange: (
    settings: AnnotationGroupDisplaySettings,
    previous?: AnnotationGroupDisplaySettings,
  ) => void
}

/** `styles` with each group's chosen fill settings; the same object without any */
function mergeFillStyles(
  styles: Readonly<Record<string, AnnotationGroupStyle>>,
  fills: Readonly<Record<string, { fill?: boolean; fillOpacity?: number }>>,
): Readonly<Record<string, AnnotationGroupStyle>> {
  const uids = Object.keys(fills).filter((uid) => uid in styles)
  if (uids.length === 0) return styles
  const merged = { ...styles }
  for (const uid of uids) merged[uid] = { ...styles[uid], ...fills[uid] }
  return merged
}

/** Bulk annotation groups: visibility, styles and clustering */
export function useAnnotationGroups(
  { sessionRef, refreshSnapshot }: ViewerAccess,
  slide: Slide,
): AnnotationGroupsApi {
  const [visibleUIDs, setVisibleUIDs] = useState<Set<string>>(() => new Set())
  const [measurementKeys, setMeasurementKeys] = useState<
    Readonly<Record<string, string>>
  >({})
  const [fillStyles, setFillStyles] = useState<
    Readonly<Record<string, { fill?: boolean; fillOpacity?: number }>>
  >({})
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
          startTransition(() => {
            setVisibleUIDs((current) =>
              applyVisibilityChanges(current, applied),
            )
          })
        }
      },
    )
  }

  return {
    visibleUIDs,
    selectedSeriesUID,
    clustering,
    displaySettings,
    measurementKeys,
    withFillStyles: (styles) => mergeFillStyles(styles, fillStyles),
    reset: () => {
      setVisibleUIDs(new Set())
      setSelectedSeriesUID(undefined)
      setMeasurementKeys({})
      setFillStyles({})
    },
    showSeries: (session, seriesInstanceUID) => {
      /**
       * Unlike a manual toggle, no validation dialog is shown, and one
       * failing group must not keep the others hidden. Panel series filter
       * follows the deep-linked series.
       */
      setSelectedSeriesUID(seriesInstanceUID)
      showMatchingSeriesItems({
        items: session.volumeViewer.getAllAnnotationGroups(),
        seriesInstanceUID,
        label: 'Microscopy Bulk Simple Annotation',
        getSeriesInstanceUID: (group) => group.seriesInstanceUID,
        getId: (group) => group.uid,
        show: (uid) => session.volumeViewer.showAnnotationGroup(uid),
        setVisible: setVisibleUIDs,
      })
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
      const { fill, fillOpacity } = styleOptions
      if (fill !== undefined || fillOpacity !== undefined) {
        setFillStyles((current) => ({
          ...current,
          [uid]: {
            ...current[uid],
            ...(fill !== undefined ? { fill } : {}),
            ...(fillOpacity !== undefined ? { fillOpacity } : {}),
          },
        }))
      }
      /** A measurement colors the group; a flat color replaces it */
      const { measurement, color } = styleOptions
      if (measurement !== undefined || color !== undefined) {
        setMeasurementKeys((current) => {
          const next = { ...current }
          if (measurement !== undefined) {
            next[uid] = codedConceptKey(measurement)
          } else {
            delete next[uid]
          }
          return next
        })
      }
      refreshSnapshot()
    },
    onStylePreview: ({ uid, styleOptions }) => {
      sessionRef.current?.volumeViewer.setAnnotationGroupStyle(
        uid,
        styleOptions,
      )
    },
    onClick: (annotationGroupUID) => {
      sessionRef.current?.volumeViewer.zoomToROI(annotationGroupUID)
    },
    onSeriesChange: (seriesInstanceUID) => {
      const viewer = sessionRef.current?.volumeViewer
      if (viewer === undefined) return
      /**
       * Switching series hides every group shown for the previous one. The
       * viewer, not panel state, says what is drawn, so a "Show all" still
       * in its transition is hidden too.
       */
      hideVisibleItems(
        viewer.getAllAnnotationGroups().map((group) => group.uid),
        (uid) => viewer.isAnnotationGroupVisible(uid),
        (uid) => viewer.hideAnnotationGroup(uid),
      )
      startTransition(() => {
        setSelectedSeriesUID(seriesInstanceUID)
        setVisibleUIDs(new Set())
      })
    },
    onDisplaySettingsChange: (settings, previous = displaySettings) => {
      /** Diff against `previous` so quick toggles build on each other */
      if (changedSettingKeys(previous, settings).length === 0) return
      const current: ClusteringSettings = {
        isEnabled: previous.clusteringEnabled,
        thresholdInput: previous.clusteringThreshold,
      }
      const next: ClusteringSettings = {
        isEnabled: settings.clusteringEnabled,
        thresholdInput: settings.clusteringThreshold,
      }
      setClustering(next)
      const viewer = sessionRef.current?.volumeViewer
      if (
        viewer !== undefined &&
        shouldApplyClusteringSettings(current, next)
      ) {
        applyClusteringOptions(viewer, next)
      }
    },
  }
}
