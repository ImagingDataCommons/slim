/** biome-ignore-all lint/a11y/noRedundantRoles: the table's display overrides (flex/block/grid) drop native table semantics in Safari/VoiceOver, so the roles are restated */
import { type JSX, useId } from 'react'

import { useLayoutMode } from '../../contexts/LayoutModeContext'
import type DicomWebManager from '../../DicomWebManager'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { SlimDialogFooter } from '../ui/dialog'
import { SearchInput } from '../ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Slider } from '../ui/slider'
import { type DisplaySet, getSeriesLabel } from './dicomTagUtils'
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

/** Full series label for the trigger and item textValue (avoids Radix truncating complex ItemText). */
function seriesTriggerLabel(displaySet: DisplaySet): string {
  const { label, description } = getSeriesLabel(displaySet)
  return description !== '' ? `${label} — ${description}` : label
}

const DicomTagBrowser = ({
  clients,
  studyInstanceUID,
  seriesInstanceUID = '',
  onDone,
}: DicomTagBrowserProps): JSX.Element => {
  const { compactChrome } = useLayoutMode()
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
      <div
        className={cn(
          'grid flex-none gap-3 border-b border-line-soft px-5 py-3.5',
          compactChrome
            ? 'grid-cols-1'
            : 'grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1fr)]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-1.5 text-12 text-ink-muted">
          <span id={seriesLabelId}>Series</span>
          <Select
            value={selectedDisplaySet?.SeriesInstanceUID ?? ''}
            onValueChange={setSelectedSeriesUID}
            disabled={isLoading || displaySets.length === 0}
          >
            <SelectTrigger
              className="h-auto min-h-9 whitespace-normal py-1.5 [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:wrap-break-word"
              aria-labelledby={seriesLabelId}
              title={
                selectedDisplaySet !== undefined
                  ? seriesTriggerLabel(selectedDisplaySet)
                  : undefined
              }
            >
              <SelectValue
                placeholder={isLoading ? 'Loading series…' : 'Select a series'}
              />
            </SelectTrigger>
            <SelectContent className="max-w-[560px]">
              {displaySets.map((displaySet) => {
                const textValue = seriesTriggerLabel(displaySet)
                const isActive = activeSeriesUIDs.has(
                  displaySet.SeriesInstanceUID,
                )
                /**
                 * Plain-text ItemText so the trigger SelectValue mirrors the
                 * full label. Complex children collapse to "SM…" under
                 * line-clamp on the trigger.
                 */
                return (
                  <SelectItem
                    key={displaySet.SeriesInstanceUID}
                    value={displaySet.SeriesInstanceUID}
                    textValue={textValue}
                    title={
                      isActive ? `${textValue} (active in viewport)` : textValue
                    }
                  >
                    {textValue}
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
            className={compactChrome ? 'h-11' : undefined}
            inputClassName={compactChrome ? 'text-[16px]' : undefined}
          />
        </div>
      </div>

      {/**
       * Explicit roles: the display overrides below (flex/block/grid) make
       * Safari/VoiceOver drop the native table semantics otherwise.
       */}
      <table
        role="table"
        aria-label="DICOM tags"
        className="flex min-h-0 w-full flex-1 flex-col border-collapse"
      >
        <thead
          role="rowgroup"
          className={cn('block flex-none', compactChrome && 'sr-only')}
        >
          <tr
            role="row"
            className={cn(
              'grid h-9 items-center gap-3 border-b border-line bg-subtle px-5 text-11 font-semibold uppercase leading-none tracking-wider text-ink-muted',
              TAG_GRID_COLUMNS,
            )}
          >
            <th
              role="columnheader"
              scope="col"
              className="text-left font-semibold"
            >
              Tag
            </th>
            <th
              role="columnheader"
              scope="col"
              className="text-left font-semibold"
            >
              VR
            </th>
            <th
              role="columnheader"
              scope="col"
              className="text-left font-semibold"
            >
              Keyword
            </th>
            <th
              role="columnheader"
              scope="col"
              className="text-left font-semibold"
            >
              Value
            </th>
          </tr>
        </thead>
        <tbody
          role="rowgroup"
          className="block h-[52vh] min-h-0 flex-1 overflow-auto"
        >
          {isLoading ? (
            <tr role="row">
              <td
                role="cell"
                colSpan={4}
                className="px-5 py-16 text-center text-ink-muted"
              >
                Loading…
              </td>
            </tr>
          ) : filteredData.length === 0 ? (
            <tr role="row">
              <td
                role="cell"
                colSpan={4}
                className="px-5 py-16 text-center text-ink-muted"
              >
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

      <SlimDialogFooter
        className={cn(
          'justify-start pl-5 text-12 text-ink-muted',
          compactChrome && 'flex-wrap',
        )}
      >
        <span className={compactChrome ? 'w-full pb-1' : undefined}>
          {attributeCount} attributes
        </span>
        {!compactChrome && <span className="flex-1" />}
        <Button
          variant="outline"
          className={cn('text-ink', compactChrome && 'min-h-11')}
          onClick={collapseAll}
          disabled={expandedKeys.size === 0}
        >
          Collapse all
        </Button>
        <Button
          variant="outline"
          className={cn('text-ink', compactChrome && 'min-h-11')}
          onClick={expandAll}
        >
          Expand all
        </Button>
        {onDone !== undefined && (
          <Button
            onClick={onDone}
            className={cn('px-4 font-semibold', compactChrome && 'min-h-11')}
          >
            Done
          </Button>
        )}
      </SlimDialogFooter>
    </div>
  )
}

export default DicomTagBrowser
