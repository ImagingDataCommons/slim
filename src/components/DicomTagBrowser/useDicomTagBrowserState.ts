import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type DicomWebManager from '../../DicomWebManager'
import { useActiveSeries } from '../../hooks/useActiveSeries'
import { useDebounce } from '../../hooks/useDebounce'
import { useSlides } from '../../hooks/useSlides'
import DicomMetadataStore, {
  EVENTS,
  type Series,
} from '../../services/DICOMMetadataStore'
import { formatGroupedNumber } from '../../utils/displayFormat'
import {
  buildDisplaySets,
  buildTagTree,
  collectExpandableKeys,
  countRows,
  filterTagTree,
  getInstanceDimensions,
  getSortedTags,
  sortInstancesByNumber,
  type TagTreeNode,
  toggleSetValue,
  toTagRecord,
} from './dicomTagUtils'

const NO_KEYS: ReadonlySet<string> = new Set()

function readStudySeries(studyInstanceUID: string): Series[] {
  return [...(DicomMetadataStore.getStudy(studyInstanceUID)?.series ?? [])]
}

export interface UseDicomTagBrowserStateInput {
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  seriesInstanceUID?: string
}

export interface UseDicomTagBrowserStateResult {
  isLoading: boolean
  activeSeriesUIDs: ReadonlySet<string>
  displaySets: ReturnType<typeof buildDisplaySets>
  selectedDisplaySet: ReturnType<typeof buildDisplaySets>[number] | undefined
  selectedSeriesUID: string
  setSelectedSeriesUID: (uid: string) => void
  instanceNumber: number
  setInstanceNumber: (value: number) => void
  currentInstanceNumber: number
  totalInstances: number
  hasMultipleInstances: boolean
  instanceLabel: string
  selectedModality: string
  searchInput: string
  setSearchInput: (value: string) => void
  filterQuery: string
  filteredData: TagTreeNode[]
  isFiltering: boolean
  expandedKeys: ReadonlySet<string>
  handleToggleExpand: (key: string) => void
  collapseAll: () => void
  expandAll: () => void
  attributeCount: number
}

/** Series/instance selection, tag tree filter and expansion for the browser. */
export function useDicomTagBrowserState({
  clients,
  studyInstanceUID,
  seriesInstanceUID = '',
}: UseDicomTagBrowserStateInput): UseDicomTagBrowserStateResult {
  const { slides, isLoading } = useSlides({ clients, studyInstanceUID })
  const activeSeriesUIDs = useActiveSeries()
  const [studySeries, setStudySeries] = useState<Series[]>(() =>
    readStudySeries(studyInstanceUID),
  )
  const [selectedSeriesUID, setSelectedSeriesUID] = useState(seriesInstanceUID)
  const [instanceNumber, setInstanceNumber] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  /** Manual expansion, valid only for the filter query it was made under */
  const [expansion, setExpansion] = useState<{
    query: string
    keys: ReadonlySet<string>
  }>({ query: '', keys: NO_KEYS })

  const debouncedQuery = useDebounce(searchInput, 300)
  const filterQuery = useDeferredValue(debouncedQuery)

  useEffect(() => {
    const handler = (): void => {
      setStudySeries(readStudySeries(studyInstanceUID))
    }
    const seriesAddedSubscription = DicomMetadataStore.subscribe(
      EVENTS.SERIES_ADDED,
      handler,
    )
    const instancesAddedSubscription = DicomMetadataStore.subscribe(
      EVENTS.INSTANCES_ADDED,
      handler,
    )
    handler()
    return () => {
      seriesAddedSubscription.unsubscribe()
      instancesAddedSubscription.unsubscribe()
    }
  }, [studyInstanceUID])

  const displaySets = useMemo(
    () => buildDisplaySets(slides, studySeries),
    [slides, studySeries],
  )

  /** Falls back to the first series until the selected one is loaded */
  const selectedDisplaySet =
    displaySets.find(
      (displaySet) => displaySet.SeriesInstanceUID === selectedSeriesUID,
    ) ?? displaySets[0]

  const sortedImages = useMemo(
    () =>
      selectedDisplaySet !== undefined
        ? sortInstancesByNumber(selectedDisplaySet.images)
        : [],
    [selectedDisplaySet],
  )
  const totalInstances = Math.max(sortedImages.length, 1)
  const currentInstanceNumber = Math.min(instanceNumber, totalInstances)
  const currentImage = sortedImages[currentInstanceNumber - 1]
  const currentMetadata = useMemo(
    () => (currentImage !== undefined ? toTagRecord(currentImage) : undefined),
    [currentImage],
  )

  const tableData = useMemo(
    () =>
      currentMetadata !== undefined
        ? buildTagTree(getSortedTags(currentMetadata))
        : [],
    [currentMetadata],
  )
  const filterResult = useMemo(
    () => filterTagTree(tableData, filterQuery),
    [tableData, filterQuery],
  )
  const filteredData = filterResult.tree
  const isFiltering = filterQuery.trim() !== ''

  const expandedKeys: ReadonlySet<string> =
    expansion.query === filterQuery
      ? expansion.keys
      : isFiltering
        ? filterResult.matchedKeys
        : NO_KEYS

  const handleToggleExpand = useCallback(
    (key: string) => {
      setExpansion({
        query: filterQuery,
        keys: toggleSetValue(expandedKeys, key),
      })
    },
    [filterQuery, expandedKeys],
  )

  const dimensions = getInstanceDimensions(currentMetadata)
  const instanceLabel =
    dimensions?.columns !== undefined && dimensions.rows !== undefined
      ? `${formatGroupedNumber(dimensions.columns)} × ${formatGroupedNumber(dimensions.rows)} px`
      : ''

  return {
    isLoading,
    activeSeriesUIDs,
    displaySets,
    selectedDisplaySet,
    selectedSeriesUID,
    setSelectedSeriesUID: (uid) => {
      setSelectedSeriesUID(uid)
      setInstanceNumber(1)
    },
    instanceNumber,
    setInstanceNumber,
    currentInstanceNumber,
    totalInstances,
    hasMultipleInstances: sortedImages.length > 1,
    instanceLabel,
    selectedModality: selectedDisplaySet?.Modality ?? '',
    searchInput,
    setSearchInput,
    filterQuery,
    filteredData,
    isFiltering,
    expandedKeys,
    handleToggleExpand,
    collapseAll: () => setExpansion({ query: filterQuery, keys: NO_KEYS }),
    expandAll: () =>
      setExpansion({
        query: filterQuery,
        keys: new Set(collectExpandableKeys(filteredData)),
      }),
    attributeCount: countRows(filteredData, expandedKeys),
  }
}
