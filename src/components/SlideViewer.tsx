import type { JSX } from 'react'

import { useSlideViewerModel } from '../features/viewer/hooks/useSlideViewerModel'
import type { RouteComponentProps } from '../utils/router'
import SlideViewerContent from './SlideViewer/SlideViewerContent'
import SlideViewerModals from './SlideViewer/SlideViewerModals'
import SlideViewerSidebar from './SlideViewer/SlideViewerSidebar'
import type { SlideViewerProps } from './SlideViewer/types'

export type SlideViewerComponentProps = Omit<
  SlideViewerProps,
  keyof RouteComponentProps
>

/**
 * Interactive viewer of one digital slide (a DICOM Series of Slide
 * Microscopy images) with its annotations, segmentations, parametric maps
 * and presentation states.
 */
function SlideViewer(props: SlideViewerComponentProps): JSX.Element {
  const model = useSlideViewerModel(props)

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <SlideViewerContent
        toolbar={model.toolbar}
        overlays={model.overlays}
        footer={model.footer}
        cursor={model.cursor}
        isFluorescence={model.isFluorescence}
        showOverviewMap={model.showOverviewMap}
        volumeViewportRef={model.volumeViewportRef}
        onViewportResize={model.onViewportResize}
      >
        <SlideViewerModals {...model.modalProps} />
        {model.confirmDialog}
      </SlideViewerContent>

      <SlideViewerSidebar
        isOpen={model.isRightPanelOpen}
        labelViewportRef={model.labelViewportRef}
        labelViewer={model.labelViewer}
        specimenMenu={model.sidebar.specimenMenu}
        equipmentMenu={model.sidebar.equipmentMenu}
        opticalPathMenu={model.sidebar.opticalPathMenu}
        presentationStateMenu={model.sidebar.presentationStateMenu}
        annotationMenu={model.sidebar.annotationMenu}
        annotationGroupMenu={model.sidebar.annotationGroupMenu}
        annotationCategoryMenu={model.sidebar.annotationCategoryMenu}
        segmentationMenu={model.sidebar.segmentationMenu}
        parametricMapMenu={model.sidebar.parametricMapMenu}
      />

      {model.hoveredRoiTooltip}
    </div>
  )
}

export default SlideViewer
