// skipcq: JS-C1003
import * as dmv from 'dicom-microscopy-viewer'
import { useEffect, useRef, useState } from 'react'
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

export interface UseStudiesReturn {
  studies: dmv.metadata.Study[]
  isLoading: boolean
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

/** Studies whose modalities were backfilled from their series. */
function mergeModalities(
  studies: dmv.metadata.Study[],
  modalitiesByUid: ReadonlyMap<string, string[]>,
): dmv.metadata.Study[] {
  return studies.map((study) => {
    const modalities = modalitiesByUid.get(study.StudyInstanceUID)
    if (
      modalities === undefined ||
      modalities.length === 0 ||
      !modalitiesNeedBackfill(study)
    ) {
      return study
    }
    return { ...study, ModalitiesInStudy: modalities }
  })
}

/**
 * Searches the slide microscopy studies of the current server and backfills
 * missing ModalitiesInStudy from series-level queries. In-flight requests
 * cannot be aborted through dicomweb-client, so superseded responses are
 * dropped instead.
 */
export function useStudies({ clients }: UseStudiesOptions): UseStudiesReturn {
  const [studies, setStudies] = useState<dmv.metadata.Study[]>([])
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Incremented per search and on cleanup so responses from superseded
   * searches (and their modality enrichment) are dropped.
   */
  const searchGeneration = useRef(0)

  useEffect(() => {
    const generation = ++searchGeneration.current
    const isCurrent = (): boolean => generation === searchGeneration.current
    const client = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
    if (client === undefined) {
      setIsLoading(false)
      return
    }

    const enrichModalities = async (
      snapshot: dmv.metadata.Study[],
    ): Promise<void> => {
      const needEnrichment = snapshot.filter(modalitiesNeedBackfill)
      if (needEnrichment.length === 0) return
      const results = await mapWithConcurrency(
        needEnrichment,
        SERIES_REQUEST_CONCURRENCY,
        async (study) => {
          const uid = study.StudyInstanceUID
          if (!isCurrent()) return { uid, modalities: [] }
          return {
            uid,
            modalities: await collectModalitiesFromSeries(client, uid),
          }
        },
      )
      if (!isCurrent()) return
      const modalitiesByUid = new Map(
        results.map(({ uid, modalities }) => [uid, modalities]),
      )
      setStudies((previous) => mergeModalities(previous, modalitiesByUid))
    }

    setIsLoading(true)
    client
      .searchForStudies({ queryParams: buildStudyQueryParams() })
      .then((results) => {
        if (!isCurrent()) return
        const formatted = results.map(
          /** DMV types formatted metadata as the generic Dataset */
          (study) =>
            dmv.metadata.formatMetadata(study).dataset as dmv.metadata.Study,
        )
        setStudies(formatted)
        setIsLoading(false)
        void enrichModalities(formatted)
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return
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

    return () => {
      searchGeneration.current += 1
    }
  }, [clients])

  return { studies, isLoading }
}
