/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
import { useEffect, useRef, useState } from 'react'
import type DicomWebManager from '../../../DicomWebManager'
import { StorageClasses } from '../../../data/uids'
import { buildStudySearchQueries } from '../utils/studyQuery'

const SEARCH_DEBOUNCE_MS = 400

interface UseStudySearchOptions {
  clients: { [key: string]: DicomWebManager }
  /** Blank disables the search */
  searchText: string
}

export interface UseStudySearchReturn {
  /** Studies the server matched for the current search text */
  matches: dmv.metadata.Study[]
  isSearching: boolean
}

interface SearchResult {
  query: string
  studies: dmv.metadata.Study[]
}

const NO_RESULT: SearchResult = { query: '', studies: [] }

/**
 * Asks the server for studies matching the worklist search text. The main
 * study list is capped by the server (IDC returns at most 100), so filtering
 * it alone misses most patients.
 */
export function useStudySearch({
  clients,
  searchText,
}: UseStudySearchOptions): UseStudySearchReturn {
  const [result, setResult] = useState<SearchResult>(NO_RESULT)
  const query = searchText.trim()
  const client = clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE]

  /** Bumped per search and on cleanup so superseded responses are dropped */
  const searchGeneration = useRef(0)

  useEffect(() => {
    const generation = ++searchGeneration.current
    const isCurrent = (): boolean => generation === searchGeneration.current
    const queries = buildStudySearchQueries(query)
    if (client === undefined || queries.length === 0) return

    const search = async (): Promise<void> => {
      const responses = await Promise.all(
        queries.map((queryParams) =>
          client.searchForStudies({ queryParams }).catch(() => []),
        ),
      )
      if (!isCurrent()) return
      const studiesByUid = new Map<string, dmv.metadata.Study>()
      for (const study of responses.flat()) {
        /** DMV types formatted metadata as the generic Dataset */
        const formatted = dmv.metadata.formatMetadata(study)
          .dataset as dmv.metadata.Study
        studiesByUid.set(formatted.StudyInstanceUID, formatted)
      }
      setResult({ query, studies: [...studiesByUid.values()] })
    }

    const timer = setTimeout(() => {
      void search()
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      searchGeneration.current += 1
    }
  }, [client, query])

  const isCurrentResult = query !== '' && result.query === query
  return {
    matches: isCurrentResult ? result.studies : [],
    isSearching: client !== undefined && query !== '' && !isCurrentResult,
  }
}
