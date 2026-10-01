// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import { useCallback, useEffect, useRef, useState } from 'react'
import type DicomWebManager from '../../../DicomWebManager'
import { StorageClasses } from '../../../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../../../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../../../utils/CustomError'
import { mapWithConcurrency } from '../../../utils/mapWithConcurrency'
import { modalitiesNeedBackfill } from '../utils/filters'
import {
  buildStudyQueryParams,
  extractModalitiesFromSeries,
} from '../utils/studyQuery'

const SERIES_REQUEST_CONCURRENCY = 6

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
}

async function collectModalitiesFromSeries(
  client: DicomWebManager,
  studyInstanceUID: string,
): Promise<string[]> {
  try {
    const seriesList = await client.searchForSeries({ studyInstanceUID })
    return extractModalitiesFromSeries(seriesList ?? [])
  } catch {
    return []
  }
}

/**
 * Hook for fetching and managing study data.
 */
export function useStudies({ clients }: UseStudiesOptions): UseStudiesReturn {
  const [studies, setStudies] = useState<dmv.metadata.Study[]>([])
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Incremented per search and on unmount so responses from superseded
   * searches (and their modality enrichment) are dropped.
   */
  const searchGeneration = useRef(0)

  useEffect(
    () => () => {
      searchGeneration.current += 1
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

      const results = await mapWithConcurrency(
        needEnrichment,
        SERIES_REQUEST_CONCURRENCY,
        async (study) => {
          if (generation !== searchGeneration.current) {
            return { uid: study.StudyInstanceUID, mods: [] }
          }
          const uid = study.StudyInstanceUID
          const mods = await collectModalitiesFromSeries(client, uid)
          return { uid, mods }
        },
      )

      if (generation !== searchGeneration.current) {
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
    [],
  )

  const searchStudies = useCallback(
    (searchCriteria?: Record<string, string>) => {
      const generation = ++searchGeneration.current
      const client = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
      if (!client) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      client
        .searchForStudies({
          queryParams: buildStudyQueryParams(searchCriteria),
        })
        .then((results) => {
          if (generation !== searchGeneration.current) return
          const formatted = results.map((study) => {
            const { dataset } = dmv.metadata.formatMetadata(study)
            return dataset as dmv.metadata.Study
          })

          setStudies(formatted)
          setIsLoading(false)

          void runModalitiesEnrichment(client, formatted, generation)
        })
        .catch((error) => {
          if (generation !== searchGeneration.current) return
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

  useEffect(() => {
    searchStudies()
  }, [searchStudies])

  return {
    studies,
    isLoading,
    totalCount: studies.length,
  }
}
