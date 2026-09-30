// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import { useCallback, useEffect, useRef, useState } from 'react'
import type DicomWebManager from '../../../DicomWebManager'
import { StorageClasses } from '../../../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../../../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../../../utils/CustomError'

import { modalitiesNeedBackfill } from '../utils/filters'

interface UseStudiesOptions {
  clients: { [key: string]: DicomWebManager }
}

interface UseStudiesReturn {
  /** All loaded studies */
  studies: dmv.metadata.Study[]
  /** Whether data is currently being loaded */
  isLoading: boolean
  /** Total count of studies */
  totalCount: number
  /** Trigger a search with optional criteria */
  searchStudies: (searchCriteria?: Record<string, string>) => void
  /** Refresh studies from server */
  refresh: () => void
}

/**
 * Hook for fetching and managing study data.
 */
export function useStudies({ clients }: UseStudiesOptions): UseStudiesReturn {
  const [studies, setStudies] = useState<dmv.metadata.Study[]>([])
  const [isLoading, setIsLoading] = useState(false)

  /** Generation counter to discard stale modality enrichment results */
  const enrichmentGeneration = useRef(0)

  /** Collect modalities from series when study-level data is missing */
  const collectModalitiesFromSeries = useCallback(
    async (
      client: DicomWebManager,
      studyInstanceUID: string,
    ): Promise<string[]> => {
      try {
        const seriesList = await client.searchForSeries({ studyInstanceUID })
        if (!seriesList) {
          return []
        }

        const modalities = new Set<string>()
        for (const raw of seriesList) {
          const { dataset } = dmv.metadata.formatMetadata(raw)
          const mod = (dataset as { Modality?: string }).Modality
          if (mod && String(mod).trim()) {
            modalities.add(String(mod))
          }
        }
        return [...modalities].sort()
      } catch {
        return []
      }
    },
    [],
  )

  /** Enrich studies with modalities from series level */
  const runModalitiesEnrichment = useCallback(
    async (
      client: DicomWebManager,
      studiesSnapshot: dmv.metadata.Study[],
      generation: number,
    ): Promise<void> => {
      const needEnrichment = studiesSnapshot.filter(modalitiesNeedBackfill)
      if (needEnrichment.length === 0) {
        return
      }

      const results = await Promise.all(
        needEnrichment.map(async (study) => {
          const uid = study.StudyInstanceUID
          const mods = await collectModalitiesFromSeries(client, uid)
          return { uid, mods }
        }),
      )

      /** Check if a newer search was started */
      if (generation !== enrichmentGeneration.current) {
        return
      }

      const uidToMods = new Map(results.map(({ uid, mods }) => [uid, mods]))

      setStudies((prev) =>
        prev.map((study) => {
          const mods = uidToMods.get(study.StudyInstanceUID)
          if (!mods || mods.length === 0 || !modalitiesNeedBackfill(study)) {
            return study
          }
          return { ...study, ModalitiesInStudy: mods }
        }),
      )
    },
    [collectModalitiesFromSeries],
  )

  const searchStudies = useCallback(
    (searchCriteria?: Record<string, string>) => {
      setIsLoading(true)

      const queryParams: Record<string, string | number | boolean> = {
        ModalitiesInStudy: 'SM',
        includefield: 'NumberOfStudyRelatedSeries',
      }

      if (searchCriteria) {
        for (const key in searchCriteria) {
          const value = searchCriteria[key]
          if (key === 'PersonName') {
            queryParams[key] = `*${value}*`
          } else {
            queryParams[key] = value
          }
        }
        queryParams.fuzzymatching = true
      }

      const client = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
      if (!client) {
        setIsLoading(false)
        return
      }

      const generation = ++enrichmentGeneration.current

      client
        .searchForStudies({ queryParams })
        .then((results) => {
          const formatted = results.map((study) => {
            const { dataset } = dmv.metadata.formatMetadata(study)
            return dataset as dmv.metadata.Study
          })

          setStudies(formatted)
          setIsLoading(false)

          /** Start background modality enrichment */
          void runModalitiesEnrichment(client, formatted, generation)
        })
        .catch((error) => {
          console.error(error)
          setIsLoading(false)
          NotificationMiddleware.onError(
            NotificationMiddlewareContext.DICOMWEB,
            new CustomError(
              errorTypes.COMMUNICATION,
              'An error occurred. Search for studies failed.',
            ),
          )
        })
    },
    [clients, runModalitiesEnrichment],
  )

  const refresh = useCallback(() => {
    searchStudies()
  }, [searchStudies])

  /** Initial load */
  useEffect(() => {
    searchStudies()
  }, [searchStudies])

  return {
    studies,
    isLoading,
    totalCount: studies.length,
    searchStudies,
    refresh,
  }
}
