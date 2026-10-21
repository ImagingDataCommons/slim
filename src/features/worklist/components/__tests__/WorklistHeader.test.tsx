import { fireEvent, render, screen } from '@testing-library/react'

import {
  DESKTOP_LAYOUT_MODE,
  LayoutModeProvider,
} from '../../../../contexts/LayoutModeContext'
import { findContainsEntry } from '../../utils/containsCatalog'
import { type WorklistContainsState, WorklistHeader } from '../WorklistHeader'

const entry = findContainsEntry('labelmap')
if (entry === undefined) throw new Error('missing labelmap entry')

const COMPACT_LAYOUT_MODE = {
  compactChrome: true,
  overlayPanels: true,
  coarsePointer: true,
} as const

function renderHeader(contains?: WorklistContainsState, compact = false): void {
  render(
    <LayoutModeProvider
      value={compact ? COMPACT_LAYOUT_MODE : DESKTOP_LAYOUT_MODE}
    >
      <WorklistHeader
        isLoading={false}
        searchText=""
        onSearchChange={() => {}}
        columnTier={compact ? 'card' : 'xl'}
        hiddenColumnIds={[]}
        contains={contains}
        onContainsChange={() => {}}
      />
    </LayoutModeProvider>,
  )
}

describe('WorklistHeader Contains summary', () => {
  it('offers Search more when another QIDO page is available', () => {
    const onLoadMore = vi.fn()
    renderHeader({
      entry,
      status: 'done',
      pages: 1,
      matchCount: 20,
      isApproximate: true,
      isPartial: true,
      searchedCount: 100,
      onRetry: () => {},
      onLoadMore,
      canLoadMore: true,
    })

    expect(
      screen.getByText(/Up to 20 studies with Label map segmentation/),
    ).toBeInTheDocument()
    expect(screen.getByText(/first 100 matches only/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Search more' }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('hides Search more when the session page cap is reached', () => {
    renderHeader({
      entry,
      status: 'done',
      pages: 10,
      matchCount: 80,
      isApproximate: false,
      isPartial: true,
      searchedCount: 1000,
      onRetry: () => {},
      onLoadMore: () => {},
      canLoadMore: false,
    })

    expect(screen.queryByRole('button', { name: 'Search more' })).toBeNull()
    expect(screen.getByText(/first 1,000 matches only/)).toBeInTheDocument()
  })

  it('says when some servers could not be searched', () => {
    renderHeader({
      entry,
      status: 'done',
      pages: 2,
      matchCount: 3,
      isApproximate: false,
      isPartial: true,
      searchedCount: 3,
      onRetry: () => {},
      onLoadMore: () => {},
      canLoadMore: true,
      hasStoreFailures: true,
    })

    expect(
      screen.getByText(/some servers could not be searched/),
    ).toBeInTheDocument()
  })

  it('stacks search under the toolbar when overlay panels are on', () => {
    render(
      <LayoutModeProvider
        value={{
          compactChrome: false,
          overlayPanels: true,
          coarsePointer: false,
        }}
      >
        <WorklistHeader
          isLoading={false}
          searchText=""
          onSearchChange={() => {}}
          columnTier="base"
          hiddenColumnIds={[]}
          onContainsChange={() => {}}
        />
      </LayoutModeProvider>,
    )

    const field = screen.getByRole('searchbox', { name: 'Search studies' })
    expect(field.closest('.w-full')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Contains' })).toHaveTextContent(
      'Contains',
    )
  })

  it('keeps the chip and its clear button when the entry cannot be searched', () => {
    const onContainsChange = vi.fn()
    render(
      <LayoutModeProvider value={DESKTOP_LAYOUT_MODE}>
        <WorklistHeader
          isLoading={false}
          searchText=""
          onSearchChange={() => {}}
          columnTier="xl"
          hiddenColumnIds={[]}
          containsEntry={entry}
          onContainsChange={onContainsChange}
        />
      </LayoutModeProvider>,
    )

    expect(
      screen.getByText(`${entry.label} can't be searched on this server.`),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: `Clear ${entry.label} filter` }),
    )
    expect(onContainsChange).toHaveBeenCalledWith(undefined)
  })

  it('keeps the Contains label on compact chrome', () => {
    renderHeader(undefined, true)

    expect(screen.getByRole('button', { name: 'Contains' })).toHaveTextContent(
      'Contains',
    )
  })

  it('puts the status under the title so a mid-width toolbar cannot squeeze it', () => {
    renderHeader({
      entry,
      status: 'done',
      pages: 1,
      matchCount: 0,
      isApproximate: false,
      isPartial: true,
      searchedCount: 35,
      onRetry: () => {},
      onLoadMore: () => {},
      canLoadMore: true,
    })

    const title = screen.getByRole('heading', { name: 'Studies' })
    const status = screen.getByText(/0 studies with Label map segmentation/)
    expect(title.parentElement).not.toBe(status.parentElement)
    expect(status.parentElement?.className).not.toContain('items-baseline')
  })
})
