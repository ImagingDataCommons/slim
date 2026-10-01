import {
  type JSX,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'

import type DicomWebManager from '../../DicomWebManager'
import { useActiveSeries } from '../../hooks/useActiveSeries'
import { useDebounce } from '../../hooks/useDebounce'
import { useSlides } from '../../hooks/useSlides'
import { cn } from '../../lib/utils'
import DicomMetadataStore, {
  EVENTS,
  type Series,
} from '../../services/DICOMMetadataStore'
import { formatGroupedNumber } from '../../utils/displayFormat'
import { Button } from '../ui/button'
import { SlimDialogFooter } from '../ui/dialog'
import { Icon } from '../ui/icon'
import { SearchInput } from '../ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Slider } from '../ui/slider'
import {
  buildDisplaySets,
  buildTagTree,
  collectExpandableKeys,
  countRows,
  filterTagTree,
  getInstanceDimensions,
  getSeriesLabel,
  getSortedTags,
  sortInstancesByNumber,
  type TagTreeNode,
  toggleSetValue,
  toTagRecord,
} from './dicomTagUtils'

export interface DicomTagBrowserProps {
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  /** Series selected when the browser opens */
  seriesInstanceUID?: string
  /** Called by the footer "Done" button */
  onDone?: () => void
}

const TAG_GRID_COLUMNS = 'grid-cols-[150px_52px_minmax(0,1fr)_minmax(0,1.4fr)]'

const NO_KEYS: ReadonlySet<string> = new Set()

/** Recursive tag row with expandable sequence items */
interface TagRowProps {
  item: TagTreeNode
  depth: number
  expandedKeys: ReadonlySet<string>
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
    'grid min-h-control w-full items-center gap-3 border-b border-line-row px-5 text-left hover:bg-selected',
    TAG_GRID_COLUMNS,
    depth > 0 ? 'bg-subtle/60' : 'bg-panel',
    hasChildren
      ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40'
      : 'cursor-default',
  )
  const cells = (
    <>
      <span
        className="flex items-center gap-0.5 font-mono text-12 text-ink-secondary"
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
          <span className="rounded bg-chip px-[5px] py-0.5 font-mono text-11 font-medium text-chip-foreground">
            {item.vr}
          </span>
        )}
      </span>
      <span className="truncate font-medium text-ink">{item.keyword}</span>
      <span className="break-all py-1.5 font-mono text-12 text-ink-body">
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

function readStudySeries(studyInstanceUID: string): Series[] {
  return [...(DicomMetadataStore.getStudy(studyInstanceUID)?.series ?? [])]
}

const DicomTagBrowser = ({
  clients,
  studyInstanceUID,
  seriesInstanceUID = '',
  onDone,
}: DicomTagBrowserProps): JSX.Element => {
  const id = useId()
  const seriesLabelId = `${id}-series`
  const instanceLabelId = `${id}-instance`

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

  const filterQuery = useDebounce(searchInput, 300)

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
  const selectedModality = selectedDisplaySet?.Modality ?? ''
  const hasMultipleInstances = sortedImages.length > 1

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-none grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-line-soft px-5 py-3.5">
        <div className="flex min-w-0 flex-col gap-1.5 text-12 text-ink-muted">
          <span id={seriesLabelId}>Series</span>
          <Select
            value={selectedDisplaySet?.SeriesInstanceUID ?? ''}
            onValueChange={(value) => {
              setSelectedSeriesUID(value)
              setInstanceNumber(1)
            }}
            disabled={isLoading || displaySets.length === 0}
          >
            <SelectTrigger className="h-9" aria-labelledby={seriesLabelId}>
              <span className="flex min-w-0 items-center gap-2">
                {selectedModality !== '' && (
                  <span className="rounded bg-chip px-[5px] py-0.5 font-mono text-11 font-semibold text-chip-foreground">
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
              {displaySets.map((displaySet) => {
                const { label, description } = getSeriesLabel(displaySet)
                const isActive = activeSeriesUIDs.has(
                  displaySet.SeriesInstanceUID,
                )
                return (
                  <SelectItem
                    key={displaySet.SeriesInstanceUID}
                    value={displaySet.SeriesInstanceUID}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">
                        {label}
                        {description !== '' ? ` — ${description}` : ''}
                      </span>
                      {isActive && (
                        <>
                          <Icon
                            name="visibility"
                            size={15}
                            className="text-ink-muted"
                          />
                          <span className="sr-only">(active in viewport)</span>
                        </>
                      )}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 text-12 text-ink-muted">
          <span className="flex justify-between gap-2">
            <span id={instanceLabelId}>Instance</span>
            <span className="truncate font-mono text-11.5 font-medium text-ink-secondary">
              {instanceLabel}
            </span>
          </span>
          <div className="flex h-9 min-w-0 items-center gap-2.5">
            <Slider
              aria-labelledby={instanceLabelId}
              min={1}
              max={Math.max(totalInstances, 2)}
              step={1}
              value={[currentInstanceNumber]}
              disabled={!hasMultipleInstances}
              onValueChange={(values) => {
                const [value] = values
                if (value !== undefined) setInstanceNumber(value)
              }}
              className="min-w-[80px] flex-1"
            />
            <span className="flex-none font-mono text-12 font-medium text-ink">
              {currentInstanceNumber} / {totalInstances}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 text-12 text-ink-muted">
          <span aria-hidden="true">Filter</span>
          <SearchInput
            aria-label="Filter tags"
            value={searchInput}
            onValueChange={setSearchInput}
            placeholder="Tag, keyword or value"
            clearable
          />
        </div>
      </div>

      <div
        className={cn(
          'grid h-9 flex-none items-center gap-3 border-b border-line bg-subtle px-5 text-11 font-semibold uppercase leading-none tracking-[0.05em] text-ink-muted',
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
            {isFiltering ? 'No matching tags found' : 'No tags available'}
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

      <SlimDialogFooter className="justify-start pl-5 text-12 text-ink-muted">
        <span>{countRows(filteredData, expandedKeys)} attributes</span>
        <span className="flex-1" />
        <Button
          variant="outline"
          className="text-ink"
          onClick={() => setExpansion({ query: filterQuery, keys: NO_KEYS })}
          disabled={expandedKeys.size === 0}
        >
          Collapse all
        </Button>
        <Button
          variant="outline"
          className="text-ink"
          onClick={() =>
            setExpansion({
              query: filterQuery,
              keys: new Set(collectExpandableKeys(filteredData)),
            })
          }
        >
          Expand all
        </Button>
        {onDone !== undefined && (
          <Button onClick={onDone} className="px-4 font-semibold">
            Done
          </Button>
        )}
      </SlimDialogFooter>
    </div>
  )
}

export default DicomTagBrowser
