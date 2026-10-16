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
export function useStudies({ clients }: UseStudiesOptions): UseStudiesReturn {
  const [studies, setStudies] = useState<dmv.metadata.Study[]>([])
  const [isLoading, setIsLoading] = useState(true)

  /** Incremented per search and on cleanup so superseded responses are dropped */
  const searchGeneration = useRef(0)

  useEffect(() => {
    const generation = ++searchGeneration.current
    const isCurrent = (): boolean => generation === searchGeneration.current
    const client = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]
    /** Keep the same empty array when already clear to avoid a render loop */
    setStudies((previous) => (previous.length === 0 ? previous : []))
    if (client === undefined) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    client
      .searchForStudies({ queryParams: buildStudyQueryParams() })
      .then((results) => {
        if (!isCurrent()) return
        setStudies(
          results.map(
            /** DMV types formatted metadata as the generic Dataset */
            (study) =>
              dmv.metadata.formatMetadata(study).dataset as dmv.metadata.Study,
          ),
        )
        setIsLoading(false)
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
