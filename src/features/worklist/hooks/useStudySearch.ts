/** skipcq: JS-C1003 */
import * as dmv from 'dicom-microscopy-viewer'
/** skipcq: JS-C1003 */
import type * as dwc from 'dicomweb-client'
import { useEffect, useRef, useState } from 'react'
import type DicomWebManager from '../../../DicomWebManager'
import { StorageClasses } from '../../../data/uids'
import {
  buildStudySearchQueries,
  type StudyQueryParams,
} from '../utils/studyQuery'

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
  /** True when at least one non-rejected query failed for the current text */
  hasError: boolean
}

interface SearchResult {
  /** Server the result came from; another server's result is never shown */
  client?: DicomWebManager
  query: string
  studies: dmv.metadata.Study[]
  failed: boolean
}

const NO_RESULT: SearchResult = { query: '', studies: [], failed: false }

function isRejectedQuery(error: unknown): boolean {
  return (error as { status?: unknown } | null)?.status === 400
}

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
  const willSearch =
    client !== undefined && buildStudySearchQueries(query).length > 0

  /** Bumped per search and on cleanup so superseded responses are dropped */
  const searchGeneration = useRef(0)

  useEffect(() => {
    const generation = ++searchGeneration.current
    const isCurrent = (): boolean => generation === searchGeneration.current
    setResult(NO_RESULT)
    const stages = buildStudySearchQueries(query)
    if (client === undefined || stages.length === 0) return

    const runQuery = async (
      queryParams: StudyQueryParams,
    ): Promise<{ studies: dwc.api.Study[]; failed: boolean }> => {
      try {
        return {
          studies: await client.searchForStudies({ queryParams }),
          failed: false,
        }
      } catch (error: unknown) {
        if (isRejectedQuery(error)) {
          return { studies: [], failed: false }
        }
        return { studies: [], failed: true }
      }
    }

    const search = async (): Promise<void> => {
      const studiesByUid = new Map<string, dmv.metadata.Study>()
      let failed = false
      /** A later stage only runs while the earlier ones found nothing */
      for (const stage of stages) {
        const responses = await Promise.all(stage.map(runQuery))
        if (!isCurrent()) return
        for (const response of responses) {
          if (response.failed) failed = true
          for (const study of response.studies) {
            /** DMV types formatted metadata as the generic Dataset */
            const formatted = dmv.metadata.formatMetadata(study)
              .dataset as dmv.metadata.Study
            studiesByUid.set(formatted.StudyInstanceUID, formatted)
          }
        }
        /**
         * A server failing every query would fail the next stage too; one
         * failing query (an attribute it cannot search) must not stop it
         */
        const stageFailed = responses.every((response) => response.failed)
        if (studiesByUid.size > 0 || stageFailed) break
      }
      setResult({ client, query, studies: [...studiesByUid.values()], failed })
    }

    const timer = setTimeout(() => {
      /** A row that cannot be formatted fails the search instead of hanging it */
      search().catch((error: unknown) => {
        console.error(error)
        if (isCurrent()) {
          setResult({ client, query, studies: [], failed: true })
        }
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      searchGeneration.current += 1
    }
  }, [client, query])

  const isCurrentResult =
    willSearch && result.query === query && result.client === client
  return {
    matches: isCurrentResult ? result.studies : [],
    isSearching: willSearch && !isCurrentResult,
    hasError: isCurrentResult && result.failed,
  }
}
