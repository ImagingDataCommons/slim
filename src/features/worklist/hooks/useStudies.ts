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

interface UseStudiesOptions {
  clients: { [key: string]: DicomWebManager }
}

export interface UseStudiesReturn {
  studies: dmv.metadata.Study[]
  isLoading: boolean
}

/**
 * Searches the slide microscopy studies of the current server. In-flight
 * requests cannot be aborted through dicomweb-client, so superseded responses
 * are dropped instead.
 */
const NO_STUDIES: dmv.metadata.Study[] = []

export function useStudies({ clients }: UseStudiesOptions): UseStudiesReturn {
  /**
   * Studies with the clients they came from, so the previous server's list
   * is never shown for a new one, not even for the frame before the effect
   */
  const [loaded, setLoaded] = useState<{
    clients?: UseStudiesOptions['clients']
    studies: dmv.metadata.Study[]
  }>({ studies: NO_STUDIES })
  const [isLoading, setIsLoading] = useState(true)

  /** Incremented per search and on cleanup so superseded responses are dropped */
  const searchGeneration = useRef(0)

  useEffect(() => {
    const generation = ++searchGeneration.current
    const isCurrent = (): boolean => generation === searchGeneration.current
    const client = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
    /** Nothing to load or store; the return below says so directly */
    if (client === undefined) return

    setIsLoading(true)
    client
      .searchForStudies({ queryParams: buildStudyQueryParams() })
      .then((results) => {
        if (!isCurrent()) return
        setLoaded({
          clients,
          studies: results.map(
            /** DMV types formatted metadata as the generic Dataset */
            (study) =>
              dmv.metadata.formatMetadata(study).dataset as dmv.metadata.Study,
          ),
        })
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return
        console.error(error)
        setLoaded({ clients, studies: NO_STUDIES })
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

  if (clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE] === undefined) {
    return { studies: NO_STUDIES, isLoading: false }
  }
  const isCurrentList = loaded.clients === clients
  return {
    studies: isCurrentList ? loaded.studies : NO_STUDIES,
    isLoading: isCurrentList ? isLoading : true,
  }
}
