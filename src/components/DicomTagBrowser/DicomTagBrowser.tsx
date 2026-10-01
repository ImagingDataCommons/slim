import { useCallback, useEffect, useMemo, useState } from 'react'

import type DicomWebManager from '../../DicomWebManager'
import { useActiveSeries } from '../../hooks/useActiveSeries'
import { useDebounce } from '../../hooks/useDebounce'
import { useSlides } from '../../hooks/useSlides'
import { cn } from '../../lib/utils'
import DicomMetadataStore, {
  EVENTS,
  type Series,
  type Study,
} from '../../services/DICOMMetadataStore'
import { formatGroupedNumber } from '../../utils/displayFormat'
import { logger } from '../../utils/logger'
import { Icon } from '../ui/icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  buildTagTree,
  collectExpandableKeys,
  countRows,
  filterTagTree,
  getInstanceDimensions,
  getSeriesLabel,
  getSortedTags,
  sortInstancesByNumber,
  sortSeriesByNumber,
  type TagTreeNode,
} from './dicomTagUtils'

interface DisplaySet {
  displaySetInstanceUID: number
  SeriesDate?: string
  SeriesTime?: string
  SeriesNumber: string
  SeriesDescription?: string
  SeriesInstanceUID?: string
  Modality: string
  images: unknown[]
}

interface DicomTagBrowserProps {
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  seriesInstanceUID?: string
  /** Called by the footer "Done" button */
  onDone?: () => void
}

function bucketContainsSopInstance(bucket: unknown[], sop: string): boolean {
  if (sop === '') return false
  for (const existing of bucket) {
    if ((existing as Record<string, unknown>).SOPInstanceUID === sop) {
      return true
    }
  }
  return false
}

const TAG_GRID_COLUMNS = 'grid-cols-[150px_52px_minmax(0,1fr)_minmax(0,1.4fr)]'

/** Recursive tag row with expandable sequence items */
interface TagRowProps {
  item: TagTreeNode
  depth: number
  expandedKeys: Set<string>
  onToggle: (key: string) => void
}

const TagRow = ({
  item,
  depth,
  expandedKeys,
  onToggle,
}: TagRowProps): JSX.Element => {
  const hasChildren = item.children !== undefined && item.children.length > 0
  const isExpanded = expandedKeys.has(item.key)

  const rowClassName = cn(
    'grid min-h-[34px] w-full items-center gap-3 border-b border-line-row px-5 text-left hover:bg-selected',
    TAG_GRID_COLUMNS,
    depth > 0 ? 'bg-subtle/60' : 'bg-panel',
    hasChildren ? 'cursor-pointer' : 'cursor-default',
  )
  const cells = (
    <>
      <span
        className="flex items-center gap-0.5 font-mono text-[12px] text-ink-secondary"
        style={{ paddingLeft: depth * 18 }}
      >
        <span className="w-4 flex-none text-ink-muted">
          {hasChildren && (
            <Icon
              name={isExpanded ? 'expand_more' : 'chevron_right'}
              size={16}
            />
          )}
        </span>
        {item.tag}
      </span>
      <span>
        {item.vr !== '' && (
          <span className="rounded bg-chip px-[5px] py-0.5 font-mono text-[11px] font-medium text-chip-foreground">
            {item.vr}
          </span>
        )}
      </span>
      <span className="truncate font-medium text-ink">{item.keyword}</span>
      <span className="break-all py-1.5 font-mono text-[12px] text-ink-body">
        {item.value}
      </span>
    </>
  )

  return (
    <>
      {hasChildren ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => onToggle(item.key)}
          className={rowClassName}
        >
          {cells}
        </button>
      ) : (
        <div className={rowClassName}>{cells}</div>
      )}
      {hasChildren &&
        isExpanded &&
        item.children?.map((child) => (
          <TagRow
            key={child.key}
            item={child}
            depth={depth + 1}
            expandedKeys={expandedKeys}
            onToggle={onToggle}
          />
        ))}
    </>
  )
}

const DicomTagBrowser = ({
  clients,
  studyInstanceUID,
  seriesInstanceUID = '',
  onDone,
}: DicomTagBrowserProps): JSX.Element => {
  const { slides, isLoading } = useSlides({ clients, studyInstanceUID })
  const activeSeriesUIDs = useActiveSeries()
  const [study, setStudy] = useState<Study | undefined>(undefined)

  const [displaySets, setDisplaySets] = useState<DisplaySet[]>([])
  const [selectedDisplaySetInstanceUID, setSelectedDisplaySetInstanceUID] =
    useState(0)
  const [instanceNumber, setInstanceNumber] = useState(1)
  const [filterValue, setFilterValue] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [searchInput, setSearchInput] = useState('')

  const debouncedSearchValue = useDebounce(searchInput, 300)

  useEffect(() => {
    if (debouncedSearchValue === '') {
      setFilterValue('')
      setExpandedKeys(new Set())
    } else {
      setFilterValue(debouncedSearchValue)
    }
  }, [debouncedSearchValue])

  useEffect(() => {
    const handler = (_event: unknown): void => {
      const study: Study | undefined = Object.assign(
        {},
        DicomMetadataStore.getStudy(studyInstanceUID),
      )
      setStudy(study)
    }
    const seriesAddedSubscription = DicomMetadataStore.subscribe(
      EVENTS.SERIES_ADDED,
      handler,
    )
    const instancesAddedSubscription = DicomMetadataStore.subscribe(
      EVENTS.INSTANCES_ADDED,
      handler,
    )

    const study = Object.assign(
      {},
      DicomMetadataStore.getStudy(studyInstanceUID),
    )
    setStudy(study)

    return () => {
      seriesAddedSubscription.unsubscribe()
      instancesAddedSubscription.unsubscribe()
    }
  }, [studyInstanceUID])

  useEffect(() => {
    let displaySets: DisplaySet[] = []
    let derivedDisplaySets: DisplaySet[] = []
    const processedSeries: string[] = []
    let index = 0

    if (slides.length > 0) {
      displaySets = slides
        .flatMap((slide): DisplaySet[] => {
          /** One row per SeriesInstanceUID; volume/overview/label often share a series. */
          const imagesBySeries = new Map<string, unknown[]>()

          const addImages = (
            images: unknown[] | undefined,
            imageType: string,
          ): void => {
            if (images?.[0] === undefined) return
            logger.debug(
              `Found ${images.length} ${imageType} image(s) for slide ${slide.containerIdentifier}`,
            )
            for (const image of images) {
              const img = image as Record<string, unknown>
              const seriesUID = img.SeriesInstanceUID as string | undefined
              if (seriesUID === undefined || seriesUID === '') continue

              let bucket = imagesBySeries.get(seriesUID)
              if (bucket === undefined) {
                processedSeries.push(seriesUID)
                bucket = []
                imagesBySeries.set(seriesUID, bucket)
              }

              const sop =
                typeof img.SOPInstanceUID === 'string' ? img.SOPInstanceUID : ''
              if (!bucketContainsSopInstance(bucket, sop)) {
                bucket.push(image)
              }
            }
          }

          addImages(slide.volumeImages, 'volume')
          addImages(slide.overviewImages, 'overview')
          addImages(slide.labelImages, 'label')

          const slideDisplaySets: DisplaySet[] = []
          for (const images of imagesBySeries.values()) {
            if (images[0] === undefined) continue
            const img = images[0] as Record<string, unknown>
            const {
              SeriesDate,
              SeriesTime,
              SeriesNumber,
              SeriesInstanceUID,
              SeriesDescription,
              Modality,
            } = img
            slideDisplaySets.push({
              displaySetInstanceUID: index,
              SeriesDate: SeriesDate as string | undefined,
              SeriesTime: SeriesTime as string | undefined,
              SeriesInstanceUID: SeriesInstanceUID as string,
              SeriesNumber: String(SeriesNumber),
              SeriesDescription: SeriesDescription as string | undefined,
              Modality: Modality as string,
              images,
            })
            index++
          }
          return slideDisplaySets
        })
        .filter((set): set is DisplaySet => set !== null && set !== undefined)
    }

    if (study !== undefined && study.series?.length > 0) {
      derivedDisplaySets = study.series
        .filter((s) => !processedSeries.includes(s.SeriesInstanceUID))
        .map((series: Series): DisplaySet => {
          const ds: DisplaySet = {
            displaySetInstanceUID: index,
            SeriesDate: series.SeriesDate,
            SeriesTime: series.SeriesTime,
            SeriesNumber: String(series.SeriesNumber),
            SeriesDescription: series.SeriesDescription,
            SeriesInstanceUID: series.SeriesInstanceUID,
            Modality: series.Modality,
            images: series?.instances?.length > 0 ? series.instances : [series],
          }
          index++
          return ds
        })
    }

    setDisplaySets([...displaySets, ...derivedDisplaySets])
  }, [slides, study])

  const sortedDisplaySets = useMemo(
    () => sortSeriesByNumber(displaySets),
    [displaySets],
  )

  const displaySetList = useMemo(() => {
    return sortedDisplaySets.map((displaySet, index) => ({
      value: index,
      ...getSeriesLabel(displaySet),
      seriesInstanceUID: displaySet.SeriesInstanceUID ?? '',
    }))
  }, [sortedDisplaySets])

  useEffect(() => {
    if (sortedDisplaySets.length === 0) return

    if (seriesInstanceUID !== '') {
      const matchingIndex = sortedDisplaySets.findIndex(
        (displaySet) => displaySet.SeriesInstanceUID === seriesInstanceUID,
      )
      if (matchingIndex !== -1) {
        setSelectedDisplaySetInstanceUID(matchingIndex)
        setInstanceNumber(1)
        return
      }
    }

    setSelectedDisplaySetInstanceUID((currentIndex) => {
      const needsReset =
        currentIndex >= sortedDisplaySets.length || currentIndex < 0
      return needsReset ? 0 : currentIndex
    })
  }, [seriesInstanceUID, sortedDisplaySets])

  useEffect(() => {
    const currentIndex = selectedDisplaySetInstanceUID
    const needsReset =
      currentIndex >= sortedDisplaySets.length || currentIndex < 0
    if (needsReset && sortedDisplaySets.length > 0) {
      setInstanceNumber(1)
    }
  }, [selectedDisplaySetInstanceUID, sortedDisplaySets.length])

  const showInstanceList =
    sortedDisplaySets[selectedDisplaySetInstanceUID]?.images.length > 1

  const totalInstances = useMemo(() => {
    return sortedDisplaySets[selectedDisplaySetInstanceUID]?.images.length ?? 1
  }, [selectedDisplaySetInstanceUID, sortedDisplaySets])

  const sortedImages = useMemo((): unknown[] => {
    const images = sortedDisplaySets[selectedDisplaySetInstanceUID]?.images
    return Array.isArray(images) ? sortInstancesByNumber(images) : []
  }, [selectedDisplaySetInstanceUID, sortedDisplaySets])

  const currentMetadata = sortedImages[instanceNumber - 1] as
    | Record<string, unknown>
    | undefined

  const tableData = useMemo((): TagTreeNode[] => {
    if (currentMetadata === undefined) return []
    return buildTagTree(getSortedTags(currentMetadata))
  }, [currentMetadata])

  const filterResult = useMemo(
    () => filterTagTree(tableData, filterValue),
    [tableData, filterValue],
  )
  const filteredData = filterResult.tree

  useEffect(() => {
    if (filterValue !== '') {
      setExpandedKeys(filterResult.matchedKeys)
    }
  }, [filterResult, filterValue])

  const handleToggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const currentInstance = getInstanceDimensions(currentMetadata)

  const instanceLabel =
    currentInstance?.columns !== undefined && currentInstance.rows !== undefined
      ? `${formatGroupedNumber(currentInstance.columns)} × ${formatGroupedNumber(currentInstance.rows)} px`
      : ''

  const selectedModality =
    sortedDisplaySets[selectedDisplaySetInstanceUID]?.Modality ?? ''

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-none grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-line-soft px-5 py-3.5">
        <div className="flex min-w-0 flex-col gap-1.5 text-[12px] text-ink-muted">
          <span id="tag-browser-series-label">Series</span>
          <Select
            value={String(selectedDisplaySetInstanceUID)}
            onValueChange={(value) => {
              setSelectedDisplaySetInstanceUID(Number(value))
              setInstanceNumber(1)
            }}
            disabled={isLoading || displaySetList.length === 0}
          >
            <SelectTrigger
              className="h-9"
              aria-labelledby="tag-browser-series-label"
            >
              <span className="flex min-w-0 items-center gap-2">
                {selectedModality !== '' && (
                  <span className="rounded bg-chip px-[5px] py-0.5 font-mono text-[11px] font-semibold text-chip-foreground">
                    {selectedModality}
                  </span>
                )}
                <span className="truncate">
                  <SelectValue
                    placeholder={
                      isLoading ? 'Loading series…' : 'Select a series'
                    }
                  />
                </span>
              </span>
            </SelectTrigger>
            <SelectContent className="max-w-[560px]">
              {displaySetList.map((item) => {
                const isActive =
                  item.seriesInstanceUID !== '' &&
                  activeSeriesUIDs.has(item.seriesInstanceUID)
                return (
                  <SelectItem key={item.value} value={String(item.value)}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">
                        {item.label}
                        {item.description !== ''
                          ? ` — ${item.description}`
                          : ''}
                      </span>
                      {isActive && (
                        <Icon
                          name="visibility"
                          size={15}
                          className="text-ink-muted"
                          title="Active in viewport"
                        />
                      )}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <label className="flex min-w-0 flex-col gap-1.5 text-[12px] text-ink-muted">
          <span className="flex justify-between gap-2">
            Instance
            <span className="truncate font-mono text-[11.5px] font-medium text-ink-secondary">
              {instanceLabel}
            </span>
          </span>
          <div className="flex h-9 min-w-0 items-center gap-2.5">
            <input
              type="range"
              min={1}
              max={totalInstances}
              value={instanceNumber}
              disabled={!showInstanceList}
              onChange={(event) =>
                setInstanceNumber(Number(event.target.value))
              }
              className="min-w-[80px] flex-1"
            />
            <span className="flex-none font-mono text-[12px] font-medium text-ink">
              {instanceNumber} / {totalInstances}
            </span>
          </div>
        </label>

        <label className="flex min-w-0 flex-col gap-1.5 text-[12px] text-ink-muted">
          Filter
          <div className="flex h-9 items-center gap-2 rounded-lg border border-line-input px-2.5 focus-within:border-primary">
            <Icon name="search" size={18} className="text-ink-muted" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tag, keyword or value"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-fainter"
            />
          </div>
        </label>
      </div>

      <div
        className={cn(
          'grid h-9 flex-none items-center gap-3 border-b border-line bg-subtle px-5 text-[11px] font-semibold uppercase leading-none tracking-[0.05em] text-ink-muted',
          TAG_GRID_COLUMNS,
        )}
      >
        <div>Tag</div>
        <div>VR</div>
        <div>Keyword</div>
        <div>Value</div>
      </div>

      <div className="h-[52vh] min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="px-5 py-16 text-center text-ink-muted">Loading…</div>
        ) : filteredData.length === 0 ? (
          <div className="px-5 py-16 text-center text-ink-muted">
            {filterValue !== ''
              ? 'No matching tags found'
              : 'No tags available'}
          </div>
        ) : (
          filteredData.map((item) => (
            <TagRow
              key={item.key}
              item={item}
              depth={0}
              expandedKeys={expandedKeys}
              onToggle={handleToggleExpand}
            />
          ))
        )}
      </div>

      <div className="flex flex-none items-center gap-2 border-t border-line-soft bg-subtle py-2.5 pl-5 pr-4 text-[12px] text-ink-muted">
        <span>{countRows(filteredData, expandedKeys)} attributes</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setExpandedKeys(new Set())}
          disabled={expandedKeys.size === 0}
          className="h-[34px] rounded-lg border border-line-input bg-panel px-3.5 text-[13px] font-medium text-ink hover:bg-subtle disabled:cursor-default disabled:text-ink-fainter disabled:hover:bg-panel"
        >
          Collapse all
        </button>
        <button
          type="button"
          onClick={() =>
            setExpandedKeys(new Set(collectExpandableKeys(filteredData)))
          }
          className="h-[34px] rounded-lg border border-line-input bg-panel px-3.5 text-[13px] font-medium text-ink hover:bg-subtle"
        >
          Expand all
        </button>
        {onDone !== undefined && (
          <button
            type="button"
            onClick={onDone}
            className="h-[34px] rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Done
          </button>
        )}
      </div>
    </div>
  )
}

export default DicomTagBrowser
