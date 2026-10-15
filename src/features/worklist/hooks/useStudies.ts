/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
import { useEffect, useRef, useState } from 'react'
import type DicomWebManager from '../../../DicomWebManager'
import { StorageClasses } from '../../../data/uids'
import NotificationMiddleware, {
  NotificationMiddlewareContext,
} from '../../../services/NotificationMiddleware'
import { CustomError, errorTypes } from '../../../utils/CustomError'
import { buildStudyQueryParams } from '../utils/studyQuery'
import { fetchMissingModalities, mergeModalities } from './modalityBackfill'

interface UseStudiesOptions {
  clients: { [key: string]: DicomWebManager }
}

export interface UseStudiesReturn {
  studies: dmv.metadata.Study[]
  isLoading: boolean
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
      const modalitiesByUid = await fetchMissingModalities(
        client,
        snapshot,
        isCurrent,
      )
      if (!isCurrent() || modalitiesByUid.size === 0) return
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
