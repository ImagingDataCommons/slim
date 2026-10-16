/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type { JSX } from 'react'

import type DicomWebManager from '../../DicomWebManager'
import type { Slide } from '../../data/slides'
import { STUDY_PANEL_ID } from '../../features/viewer/utils/panelIds'
import { cn } from '../../lib/utils'
import ClinicalTrial from '../ClinicalTrial'
import Patient from '../Patient'
import SlideList from '../SlideList'
import Study from '../Study'
import {
  CountBadge,
  PanelDivider,
  SlimCollapsibleSection,
} from '../slim/SlimCollapsibleSection'

export interface StudySidePanelProps {
  isOpen: boolean
  clients: { [key: string]: DicomWebManager }
  slides: Slide[]
  refImage: dmv.metadata.VLWholeSlideMicroscopyImage
  selectedSeriesInstanceUID: string
  onSeriesSelection: (change: { seriesInstanceUID: string }) => void
}

/** Left study panel: patient / study / trial metadata and the slide list. */
export function StudySidePanel({
  isOpen,
  clients,
  slides,
  refImage,
  selectedSeriesInstanceUID,
  onSeriesSelection,
}: StudySidePanelProps): JSX.Element {
  return (
    <aside
      id={STUDY_PANEL_ID}
      aria-label="Study panel"
      className={cn(
        'flex min-h-0 w-sidebar flex-none flex-col border-r border-line bg-panel',
        !isOpen && 'hidden',
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <SlimCollapsibleSection title="Patient" padding="indent">
          <Patient metadata={refImage} />
        </SlimCollapsibleSection>
        <SlimCollapsibleSection title="Study" padding="indent">
          <Study metadata={refImage} />
        </SlimCollapsibleSection>
        {refImage.ClinicalTrialSponsorName != null && (
          <>
            <SlimCollapsibleSection
              title="Clinical trial"
              padding="indent"
              defaultOpen={false}
              divider={false}
            >
              <ClinicalTrial metadata={refImage} />
            </SlimCollapsibleSection>
            <PanelDivider className="mb-1" />
          </>
        )}

        <div className="flex items-center gap-2 px-4 pb-2.5 pt-3">
          <span className="text-11 font-semibold uppercase leading-none tracking-[0.06em] text-ink-secondary">
            Slides
          </span>
          <CountBadge count={slides.length} />
        </div>
        <SlideList
          clients={clients}
          metadata={slides}
          selectedSeriesInstanceUID={selectedSeriesInstanceUID}
          onSeriesSelection={onSeriesSelection}
        />
      </div>
    </aside>
  )
}
