import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { useCallback } from 'react'

import { SLIDE_PANEL_ID } from '../../features/viewer/utils/panelIds'
import { cn } from '../../lib/utils'
import { SlimCollapsibleSection } from '../slim/SlimCollapsibleSection'

interface SlideViewerSidebarProps {
  isOpen: boolean
  labelViewportRef: React.RefObject<HTMLDivElement>
  labelViewer?: dmv.viewer.LabelImageViewer
  specimenMenu: React.ReactNode
  equipmentMenu: React.ReactNode
  opticalPathMenu: React.ReactNode
  presentationStateMenu: React.ReactNode
  annotationMenu: React.ReactNode
  annotationGroupMenu: React.ReactNode
  annotationCategoryMenu: React.ReactNode
  segmentationMenu: React.ReactNode
  parametricMapMenu: React.ReactNode
}

/**
 * Right "slide" panel: label, specimens, equipment, optical paths,
 * presentation states, annotations, groups, categories, segmentations and
 * parametric maps. Kept mounted while hidden so the DMV label viewer and
 * item state survive panel toggles.
 */
const SlideViewerSidebar: React.FC<SlideViewerSidebarProps> = ({
  isOpen,
  labelViewportRef,
  labelViewer,
  specimenMenu,
  equipmentMenu,
  opticalPathMenu,
  presentationStateMenu,
  annotationMenu,
  annotationGroupMenu,
  annotationCategoryMenu,
  segmentationMenu,
  parametricMapMenu,
}) => {
  const handleLabelOpenChange = useCallback((): void => {
    requestAnimationFrame(() => labelViewer?.resize())
  }, [labelViewer])

  return (
    <aside
      id={SLIDE_PANEL_ID}
      aria-label="Slide panel"
      className={cn(
        'flex min-h-0 w-sidebar-right flex-none flex-col border-l border-line bg-panel',
        !isOpen && 'hidden',
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4">
        {labelViewer !== undefined && (
          <SlimCollapsibleSection
            title="Slide label"
            keepMounted
            onOpenChange={handleLabelOpenChange}
          >
            <div className="slim-stripes relative h-[120px] overflow-hidden rounded-lg border border-line">
              <div ref={labelViewportRef} className="absolute inset-0" />
            </div>
          </SlimCollapsibleSection>
        )}
        {specimenMenu}
        {equipmentMenu}
        {opticalPathMenu}
        {presentationStateMenu}
        {annotationMenu}
        {annotationGroupMenu}
        {annotationCategoryMenu}
        {segmentationMenu}
        {parametricMapMenu}
      </div>
    </aside>
  )
}

export default SlideViewerSidebar
