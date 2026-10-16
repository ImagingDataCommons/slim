import { type JSX, useId } from 'react'

import type DicomWebManager from '../../DicomWebManager'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { SlimDialogFooter } from '../ui/dialog'
import { Icon } from '../ui/icon'
import { MonoChip } from '../ui/mono-chip'
import { SearchInput } from '../ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Slider } from '../ui/slider'
import { getSeriesLabel } from './dicomTagUtils'
import { TAG_GRID_COLUMNS, TagRow } from './TagRow'
import { useDicomTagBrowserState } from './useDicomTagBrowserState'

export interface DicomTagBrowserProps {
  clients: { [key: string]: DicomWebManager }
  studyInstanceUID: string
  /** Series selected when the browser opens */
  seriesInstanceUID?: string
  /** Called by the footer "Done" button */
  onDone?: () => void
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

  const {
    isLoading,
    activeSeriesUIDs,
    displaySets,
    selectedDisplaySet,
    setSelectedSeriesUID,
    setInstanceNumber,
    currentInstanceNumber,
    totalInstances,
    hasMultipleInstances,
    instanceLabel,
    selectedModality,
    searchInput,
    setSearchInput,
    filteredData,
    isFiltering,
    expandedKeys,
    handleToggleExpand,
    collapseAll,
    expandAll,
    attributeCount,
  } = useDicomTagBrowserState({
    clients,
    studyInstanceUID,
    seriesInstanceUID,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-none grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-line-soft px-5 py-3.5">
        <div className="flex min-w-0 flex-col gap-1.5 text-12 text-ink-muted">
          <span id={seriesLabelId}>Series</span>
          <Select
            value={selectedDisplaySet?.SeriesInstanceUID ?? ''}
            onValueChange={setSelectedSeriesUID}
            disabled={isLoading || displaySets.length === 0}
          >
            <SelectTrigger className="h-9" aria-labelledby={seriesLabelId}>
              <span className="flex min-w-0 items-center gap-2">
                {selectedModality !== '' && (
                  <MonoChip size="sm" className="font-semibold">
                    {selectedModality}
                  </MonoChip>
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

      <table
        aria-label="DICOM tags"
        className="flex min-h-0 w-full flex-1 flex-col border-collapse"
      >
        <thead className="block flex-none">
          <tr
            className={cn(
              'grid h-9 items-center gap-3 border-b border-line bg-subtle px-5 text-11 font-semibold uppercase leading-none tracking-wider text-ink-muted',
              TAG_GRID_COLUMNS,
            )}
          >
            <th scope="col" className="text-left font-semibold">
              Tag
            </th>
            <th scope="col" className="text-left font-semibold">
              VR
            </th>
            <th scope="col" className="text-left font-semibold">
              Keyword
            </th>
            <th scope="col" className="text-left font-semibold">
              Value
            </th>
          </tr>
        </thead>
        <tbody className="block h-[52vh] min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <tr>
              <td colSpan={4} className="px-5 py-16 text-center text-ink-muted">
                Loading…
              </td>
            </tr>
          ) : filteredData.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-5 py-16 text-center text-ink-muted">
                {isFiltering ? 'No matching tags found' : 'No tags available'}
              </td>
            </tr>
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
        </tbody>
      </table>

      <SlimDialogFooter className="justify-start pl-5 text-12 text-ink-muted">
        <span>{attributeCount} attributes</span>
        <span className="flex-1" />
        <Button
          variant="outline"
          className="text-ink"
          onClick={collapseAll}
          disabled={expandedKeys.size === 0}
        >
          Collapse all
        </Button>
        <Button variant="outline" className="text-ink" onClick={expandAll}>
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
