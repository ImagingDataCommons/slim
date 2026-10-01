import type * as React from 'react'

import { PanelDivider } from '../../../components/slim/SlimCollapsibleSection'
import { Icon } from '../../../components/ui/icon'
import { Skeleton } from '../../../components/ui/skeleton'
import { cn } from '../../../lib/utils'
import { SLIDE_PANEL_ID, STUDY_PANEL_ID } from '../utils/panelIds'
import { ViewportLoadingIndicator } from './ViewportLoadingIndicator'

const VALUE_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-2/5', 'w-3/5']
const ROW_KEYS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

function SectionHeader({ title }: { title?: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 px-3.5 pb-2 pt-3 text-11 font-semibold uppercase leading-none tracking-[0.06em] text-ink-secondary">
      <Icon name="expand_more" size={18} className="text-ink-faint" />
      {title !== undefined ? title : <Skeleton className="h-2 w-24" />}
    </div>
  )
}

function KeyValueRows({ count }: { count: number }): React.ReactElement {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 pb-3.5 pl-[38px] pr-4 pt-1">
      {ROW_KEYS.slice(0, count).map((key, index) => (
        <KeyValueRow key={key} index={index} />
      ))}
    </div>
  )
}

function KeyValueRow({ index }: { index: number }): React.ReactElement {
  return (
    <>
      <Skeleton className="h-2 w-16 bg-line-soft" />
      <Skeleton
        className={cn('h-2', VALUE_WIDTHS[index % VALUE_WIDTHS.length])}
      />
    </>
  )
}

function SlideCardSkeleton(): React.ReactElement {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line px-2.5 py-2.5">
      <Skeleton className="h-12 w-12 flex-none rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-2.5 w-3/4" />
        <Skeleton className="h-2 w-1/2 bg-line-soft" />
      </div>
    </div>
  )
}

/**
 * Viewer chrome shown while the study metadata loads, so the panels and the
 * viewport appear right away instead of a blank page.
 */
export function ViewerLoadingLayout({
  isLeftPanelOpen,
}: {
  isLeftPanelOpen: boolean
}): React.ReactElement {
  return (
    <div className="flex h-full min-h-0" aria-busy="true">
      <aside
        id={STUDY_PANEL_ID}
        aria-label="Study panel"
        className={cn(
          'flex min-h-0 w-sidebar flex-none flex-col overflow-hidden border-r border-line bg-panel',
          !isLeftPanelOpen && 'hidden',
        )}
      >
        <SectionHeader title="Patient" />
        <KeyValueRows count={4} />
        <PanelDivider />
        <SectionHeader title="Study" />
        <KeyValueRows count={5} />
        <PanelDivider />
        <div className="px-4 pb-2.5 pt-3 text-11 font-semibold uppercase leading-none tracking-[0.06em] text-ink-secondary">
          Slides
        </div>
        <div className="flex flex-col gap-2 px-3">
          <SlideCardSkeleton />
          <SlideCardSkeleton />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-toolbar flex-none items-center gap-2 border-b border-line bg-panel px-2.5">
            <span className="grid h-control w-control flex-none place-items-center text-ink-secondary opacity-40">
              <Icon name="left_panel_close" size={20} />
            </span>
            <div className="h-[22px] w-px flex-none bg-line" />
            <div className="flex min-w-0 flex-1 justify-center">
              <Skeleton className="h-[38px] w-[min(520px,70%)] rounded-card bg-app" />
            </div>
            <div className="h-[22px] w-px flex-none bg-line" />
            <span className="grid h-control w-control flex-none place-items-center text-ink-secondary opacity-40">
              <Icon name="right_panel_close" size={20} />
            </span>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden bg-viewport">
            <ViewportLoadingIndicator isVisible label="Loading study" />
          </div>
          <div className="flex h-footer flex-none items-center border-t border-line bg-panel px-3.5">
            <Skeleton className="h-2 w-40 bg-line-soft" />
          </div>
        </section>

        <aside
          id={SLIDE_PANEL_ID}
          aria-label="Slide panel"
          className="flex min-h-0 w-sidebar-right flex-none flex-col overflow-hidden border-l border-line bg-panel"
        >
          <SectionHeader />
          <KeyValueRows count={4} />
          <PanelDivider />
          <SectionHeader />
          <KeyValueRows count={3} />
          <PanelDivider />
          <SectionHeader />
          <KeyValueRows count={3} />
          <PanelDivider />
          <SectionHeader />
          <KeyValueRows count={2} />
        </aside>
      </main>
    </div>
  )
}
